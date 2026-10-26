import { Transaction } from '../../domain/transaction.entity';
import { TransactionOrmEntity } from './transaction.orm-entity';

export function toOrm(transaction: Transaction): TransactionOrmEntity {
  const entity = new TransactionOrmEntity();

  entity.id = transaction.id;
  entity.accountId = transaction.accountId;
  entity.type = transaction.type;
  entity.amount = transaction.amount;
  entity.currency = transaction.currency;
  entity.description = transaction.description;
  entity.status = transaction.status;
  entity.providerTransactionId = transaction.providerTransactionId;
  entity.balanceAfter = transaction.balanceAfter;
  entity.failureReason = transaction.failureReason;
  entity.idempotencyKey = transaction.idempotencyKey;
  entity.createdAt = transaction.createdAt;

  return entity;
}

export function toDomain(entity: TransactionOrmEntity): Transaction {
  return new Transaction({
    id: entity.id,
    accountId: entity.accountId,
    type: entity.type,
    amount: entity.amount,
    currency: entity.currency,
    description: entity.description,
    status: entity.status,
    providerTransactionId: entity.providerTransactionId,
    balanceAfter: entity.balanceAfter,
    failureReason: entity.failureReason,
    idempotencyKey: entity.idempotencyKey,
    createdAt: entity.createdAt,
  });
}
