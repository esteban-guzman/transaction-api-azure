import { Inject, Injectable } from '@nestjs/common';

import { IdempotencyConflictError } from '../domain/errors/idempotency-conflict.error';
import {
  Transaction,
  type TransactionPayload,
} from '../domain/transaction.entity';
import { TransactionStatus } from '../domain/transaction-status.enum';
import { TRANSACTION_REPOSITORY } from '../domain/transaction.repository';
import type { TransactionRepository } from '../domain/transaction.repository';
import { PROVIDER_PORT, ProviderUnavailableError } from './provider.port';
import type { ProviderPort } from './provider.port';

@Injectable()
export class ExecuteTransactionUseCase {
  constructor(
    @Inject(PROVIDER_PORT)
    private readonly provider: ProviderPort,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(payload: TransactionPayload): Promise<Transaction> {
    const existingTransaction =
      await this.getTransactionByIdempotencyKey(payload);

    if (existingTransaction) {
      return existingTransaction;
    }

    Transaction.validatePayload(payload);

    try {
      const providerResponse = await this.provider.execute(payload);

      return this.transactions.save(
        Transaction.fromResponse(payload, providerResponse),
      );
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) {
        throw error instanceof Error
          ? error
          : new Error('Unexpected error while executing the transaction.');
      }

      await this.transactions.save(
        Transaction.fromFailure(payload, error.message),
      );

      throw error;
    }
  }

  private async getTransactionByIdempotencyKey(
    payload: TransactionPayload,
  ): Promise<Transaction | null> {
    if (payload.idempotencyKey == null) {
      return null;
    }

    const existing = await this.transactions.findByIdempotencyKey(
      payload.idempotencyKey,
    );

    if (!existing) {
      return null;
    }

    if (!existing.hasSamePayload(payload)) {
      throw new IdempotencyConflictError(payload.idempotencyKey);
    }

    if (existing.status === TransactionStatus.FAILED) {
      throw new ProviderUnavailableError(
        existing.failureReason ?? 'The provider is unavailable.',
        true,
      );
    }

    return existing;
  }
}
