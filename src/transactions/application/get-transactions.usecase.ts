import { Inject, Injectable } from '@nestjs/common';

import { TransactionStatus } from '../domain/transaction-status.enum';
import { TransactionType } from '../domain/transaction-type.enum';
import {
  TRANSACTION_REPOSITORY,
  type TransactionPage,
  type TransactionRepository,
} from '../domain/transaction.repository';

export const DEFAULT_PAGE_LIMIT = 10;
export const MAX_PAGE_LIMIT = 100;

export interface GetTransactionsQuery {
  accountId?: string;
  status?: TransactionStatus;
  type?: TransactionType;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class GetTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(query: GetTransactionsQuery): Promise<TransactionPage> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

    return this.transactions.findAll(
      {
        accountId: query.accountId,
        status: query.status,
        type: query.type,
      },
      {
        cursor: query.cursor,
        limit,
      },
    );
  }
}
