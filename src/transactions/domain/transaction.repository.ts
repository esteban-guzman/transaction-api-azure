import { Transaction } from './transaction.entity';
import { TransactionStatus } from './transaction-status.enum';
import { TransactionType } from './transaction-type.enum';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionFilters {
  accountId?: string;
  status?: TransactionStatus;
  type?: TransactionType;
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

export interface TransactionRepository {
  save(transaction: Transaction): Promise<Transaction>;
  findByIdempotencyKey(key: string): Promise<Transaction | null>;
  findAll(
    filters: TransactionFilters,
    pagination: CursorPagination,
  ): Promise<TransactionPage>;
}
