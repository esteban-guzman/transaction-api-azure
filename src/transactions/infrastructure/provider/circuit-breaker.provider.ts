import { Injectable } from '@nestjs/common';

import {
  type ProviderPort,
  ProviderUnavailableError,
} from '../../application/provider.port';
import type {
  ProviderResponse,
  TransactionPayload,
} from '../../domain/transaction.entity';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class CircuitBreakerProvider implements ProviderPort {
  private readonly FAILURE_THRESHOLD = 5;
  private readonly OPEN_MS = 10_000;

  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;

  constructor(private readonly provider: ProviderPort) {}

  async execute(payload: TransactionPayload): Promise<ProviderResponse> {
    if (this.isOpen()) {
      throw new ProviderUnavailableError(
        'The provider circuit is open.',
        true,
      );
    }

    try {
      const result = await this.provider.execute(payload);
      this.onSuccess();
      return result;
    } catch (error) {
      if (error instanceof ProviderUnavailableError && error.retryable) {
        this.onFailure();
      }

      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state !== 'OPEN') {
      return false;
    }

    if (Date.now() - this.openedAt < this.OPEN_MS) {
      return true;
    }

    this.state = 'HALF_OPEN';
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures += 1;

    if (this.state === 'HALF_OPEN' || this.failures >= this.FAILURE_THRESHOLD) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
