import { ApiProperty } from '@nestjs/swagger';

import { TransactionStatus } from '../../../domain/transaction-status.enum';
import { TransactionType } from '../../../domain/transaction-type.enum';
import { Transaction } from '../../../domain/transaction.entity';
import { TransactionPage } from '../../../domain/transaction.repository';

export class TransactionResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'acc-123456' })
  accountId: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty({ example: 1500.0 })
  amount: number;

  @ApiProperty({ example: 'MXN' })
  currency: string;

  @ApiProperty({ nullable: true, example: 'Incoming transfer' })
  description: string | null;

  @ApiProperty({ enum: TransactionStatus })
  status: TransactionStatus;

  @ApiProperty({ nullable: true, example: 'txn-789' })
  providerTransactionId: string | null;

  @ApiProperty({ nullable: true, example: 5500.0 })
  balanceAfter: number | null;

  @ApiProperty({ nullable: true, example: 'INSUFFICIENT_FUNDS' })
  failureReason: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class TransactionPageResponse {
  @ApiProperty({ type: [TransactionResponse] })
  data: TransactionResponse[];

  @ApiProperty({
    nullable: true,
    description:
      'Cursor for the next (older) page. `null` if there are no more.',
  })
  nextCursor: string | null;
}

export function toTransactionResponse(
  transaction: Transaction,
): TransactionResponse {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    status: transaction.status,
    providerTransactionId: transaction.providerTransactionId,
    balanceAfter: transaction.balanceAfter,
    failureReason: transaction.failureReason,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export function toTransactionPageResponse(
  page: TransactionPage,
): TransactionPageResponse {
  return {
    data: page.items.map(toTransactionResponse),
    nextCursor: page.nextCursor,
  };
}
