import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

import {
  ProviderPort,
  ProviderUnavailableError,
} from '../../application/provider.port';
import type {
  ProviderRejected,
  ProviderResponse,
  TransactionPayload,
} from '../../domain/transaction.entity';

type ProviderHttpApproved = {
  status: 'APPROVED';
  transactionId: string;
  balance: number;
  executedAt: string;
};

@Injectable()
export class HttpProviderAdapter implements ProviderPort {
  private readonly EXECUTE_PATH = '/provider/v1/execute';
  private readonly MAX_ATTEMPTS = 3;
  private readonly BACKOFF_BASE_MS = 100;

  private readonly logger = new Logger(HttpProviderAdapter.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.baseUrl = config.getOrThrow<string>('provider.baseUrl');
    this.timeoutMs = config.getOrThrow<number>('provider.timeoutMs');
  }

  async execute(payload: TransactionPayload): Promise<ProviderResponse> {
    for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
      try {
        const response = await firstValueFrom(
          this.http.post<ProviderHttpApproved>(
            `${this.baseUrl}${this.EXECUTE_PATH}`,
            {
              accountId: payload.accountId,
              type: payload.type,
              amount: payload.amount,
              currency: payload.currency,
            },
            { timeout: this.timeoutMs },
          ),
        );

        return {
          status: response.data.status,
          transactionId: response.data.transactionId,
          balance: Number(response.data.balance),
        };
      } catch (error) {
        const businessRejection = this.getBusinessRejection(error);
        if (businessRejection) {
          return businessRejection;
        }

        const unavailableError = this.getUnavailableError(error);
        if (!unavailableError.retryable || attempt === this.MAX_ATTEMPTS) {
          throw unavailableError;
        }

        this.logger.warn(
          `Attempt ${attempt}/${this.MAX_ATTEMPTS} failed for account ${payload.accountId}: ${unavailableError.message}`,
        );

        await this.backoff(attempt);
      }
    }

    throw new ProviderUnavailableError(
      'Could not complete the provider execution.',
      true,
    );
  }

  private getBusinessRejection(error: unknown): ProviderRejected | null {
    const response = (error as AxiosError<ProviderRejected>).response;
    const body = response?.data;

    if (
      response === undefined ||
      response.status < 400 ||
      response.status >= 500 ||
      body?.status !== 'REJECTED' ||
      !body.code ||
      !body.message
    ) {
      return null;
    }

    return body;
  }

  private getUnavailableError(error: unknown): ProviderUnavailableError {
    const axiosError = error as AxiosError;

    if (
      axiosError?.code === 'ECONNABORTED' ||
      axiosError?.code === 'ETIMEDOUT'
    ) {
      return new ProviderUnavailableError(
        `The provider did not respond within ${this.timeoutMs}ms.`,
        true,
        error,
      );
    }

    if (!axiosError?.response) {
      return new ProviderUnavailableError(
        `Could not connect to the provider (${axiosError?.code ?? 'unknown error'}).`,
        true,
        error,
      );
    }

    if (axiosError.response.status >= 500) {
      return new ProviderUnavailableError(
        `The provider responded with error ${axiosError.response.status}.`,
        true,
        error,
      );
    }

    return new ProviderUnavailableError(
      error instanceof Error
        ? error.message
        : 'Unexpected failure while calling the provider.',
      false,
      error,
    );
  }

  private backoff(attempt: number): Promise<void> {
    const randomFactor = Math.random() * 50;
    const delayMs = this.BACKOFF_BASE_MS * 2 ** (attempt - 1) + randomFactor;

    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
