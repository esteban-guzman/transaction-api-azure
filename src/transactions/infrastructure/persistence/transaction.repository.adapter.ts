import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';

import { IdempotencyConflictError } from '../../domain/errors/idempotency-conflict.error';
import { Transaction } from '../../domain/transaction.entity';
import {
  CursorPagination,
  TransactionFilters,
  TransactionPage,
  TransactionRepository,
} from '../../domain/transaction.repository';
import { decodeCursor, encodeCursor } from './transaction.cursor';
import { toDomain, toOrm } from './transaction.mapper';
import { TransactionOrmEntity } from './transaction.orm-entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class TransactionRepositoryAdapter implements TransactionRepository {
  private readonly logger = new Logger('Transactions');

  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly repository: Repository<TransactionOrmEntity>,
  ) {}

  async save(transaction: Transaction): Promise<Transaction> {
    try {
      const saved = await this.repository.save(toOrm(transaction));
      this.logger.log({
        insert: {
          id: saved.id,
          accountId: saved.accountId,
          type: saved.type,
          amount: saved.amount,
          currency: saved.currency,
          status: saved.status,
        },
      });

      return toDomain(saved);
    } catch (error) {
      this.logger.error(
        `insert failed  ${transaction.type} ${transaction.amount} ${transaction.currency}  account=${transaction.accountId}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (transaction.idempotencyKey && isUniqueViolation(error)) {
        throw new IdempotencyConflictError(transaction.idempotencyKey);
      }

      throw error;
    }
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const transaction = await this.repository.findOne({
      where: { idempotencyKey: key },
    });

    return transaction ? toDomain(transaction) : null;
  }

  async findAll(
    filters: TransactionFilters,
    pagination: CursorPagination,
  ): Promise<TransactionPage> {
    const queryBuilder = this.repository.createQueryBuilder('t');

    this.applyFilters(queryBuilder, filters);
    this.applyCursor(queryBuilder, pagination.cursor);

    const rows = await queryBuilder
      .orderBy('t.created_at', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .take(pagination.limit + 1)
      .getMany();

    const hasMore = rows.length > pagination.limit;
    const page = hasMore ? rows.slice(0, pagination.limit) : rows;

    this.logger.log({
      query: {
        ...filters,
        limit: pagination.limit,
        page: pagination.cursor,
        rows: page.length,
        hasMore,
      },
    });

    return {
      items: page.map(toDomain),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
    };
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<TransactionOrmEntity>,
    filters: TransactionFilters,
  ): void {
    if (filters.accountId) {
      queryBuilder.andWhere('t.account_id = :accountId', {
        accountId: filters.accountId,
      });
    }
    if (filters.status) {
      queryBuilder.andWhere('t.status = :status', { status: filters.status });
    }
    if (filters.type) {
      queryBuilder.andWhere('t.type = :type', { type: filters.type });
    }
  }

  private applyCursor(
    queryBuilder: SelectQueryBuilder<TransactionOrmEntity>,
    cursor?: string,
  ): void {
    if (!cursor) {
      return;
    }

    const { createdAt, id } = decodeCursor(cursor);

    queryBuilder.andWhere(
      '(t.created_at, t.id) < (:cursorCreatedAt::timestamptz, :cursorId::uuid)',
      { cursorCreatedAt: createdAt, cursorId: id },
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as { code?: string } | undefined;

  return driverError?.code === POSTGRES_UNIQUE_VIOLATION;
}
