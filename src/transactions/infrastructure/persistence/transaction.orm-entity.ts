import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  type ValueTransformer,
} from 'typeorm';

import { MAX_IDEMPOTENCY_KEY_LENGTH } from '../../domain/transaction.constants';
import { TransactionStatus } from '../../domain/transaction-status.enum';
import { TransactionType } from '../../domain/transaction-type.enum';

const decimalTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};

@Entity('transactions')
@Index('idx_transactions_created_at_id', ['createdAt', 'id'])
@Index('uq_transactions_idempotency_key', ['idempotencyKey'], { unique: true })
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: MAX_IDEMPOTENCY_KEY_LENGTH,
    nullable: true,
  })
  idempotencyKey: string | null;

  @Index('idx_transactions_account_id')
  @Column({ name: 'account_id', type: 'varchar', length: 36 })
  accountId: string;

  @Index('idx_transactions_type')
  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Index('idx_transactions_status')
  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  providerTransactionId: string | null;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  balanceAfter: number | null;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
