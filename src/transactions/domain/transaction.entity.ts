import { randomUUID } from 'node:crypto';

import { AmountExceedsLimitError } from './errors/amount-exceeds-limit.error';
import { InvalidAmountError } from './errors/invalid-amount.error';
import { UnsupportedCurrencyError } from './errors/unsupported-currency.error';
import { TransactionStatus } from './transaction-status.enum';
import { TransactionType } from './transaction-type.enum';
import {
  DEBIT_MAX_AMOUNT,
  MINIMUM_AMOUNT,
  SUPPORTED_CURRENCY,
} from './transaction.constants';

export interface TransactionPayload {
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string | null;
  idempotencyKey?: string | null;
}

export type ProviderApproved = {
  status: 'APPROVED';
  transactionId: string;
  balance: number;
};

export type ProviderRejected = {
  status: 'REJECTED';
  code: string;
  message: string;
};

export type ProviderResponse = ProviderApproved | ProviderRejected;

export interface TransactionProps {
  id: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  status: TransactionStatus;
  providerTransactionId: string | null;
  balanceAfter: number | null;
  failureReason: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
}

export class Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly type: TransactionType;
  readonly amount: number;
  readonly currency: string;
  readonly description: string | null;
  readonly status: TransactionStatus;
  readonly providerTransactionId: string | null;
  readonly balanceAfter: number | null;
  readonly failureReason: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;

  constructor(props: TransactionProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.type = props.type;
    this.amount = props.amount;
    this.currency = props.currency;
    this.description = props.description;
    this.status = props.status;
    this.providerTransactionId = props.providerTransactionId;
    this.balanceAfter = props.balanceAfter;
    this.failureReason = props.failureReason;
    this.idempotencyKey = props.idempotencyKey;
    this.createdAt = props.createdAt;
  }

  static validatePayload(payload: TransactionPayload): void {
    if (payload.amount <= MINIMUM_AMOUNT) {
      throw new InvalidAmountError(payload.amount, MINIMUM_AMOUNT);
    }

    if (payload.currency !== SUPPORTED_CURRENCY) {
      throw new UnsupportedCurrencyError(payload.currency, SUPPORTED_CURRENCY);
    }

    if (
      payload.type === TransactionType.DEBIT &&
      payload.amount > DEBIT_MAX_AMOUNT
    ) {
      throw new AmountExceedsLimitError(
        payload.type,
        payload.amount,
        DEBIT_MAX_AMOUNT,
      );
    }
  }

  static fromResponse(
    payload: TransactionPayload,
    response: ProviderResponse,
  ): Transaction {
    if (response.status === 'APPROVED') {
      return new Transaction({
        ...Transaction.fromPayload(payload),
        status: TransactionStatus.EXECUTED,
        providerTransactionId: response.transactionId,
        balanceAfter: response.balance,
      });
    }

    return new Transaction({
      ...Transaction.fromPayload(payload),
      status: TransactionStatus.REJECTED,
      failureReason: response.message,
    });
  }

  static fromFailure(
    payload: TransactionPayload,
    failureReason: string,
  ): Transaction {
    return new Transaction({
      ...Transaction.fromPayload(payload),
      status: TransactionStatus.FAILED,
      failureReason,
    });
  }

  hasSamePayload(payload: TransactionPayload): boolean {
    return (
      this.accountId === payload.accountId &&
      this.type === payload.type &&
      this.amount === payload.amount &&
      this.currency === payload.currency &&
      (this.description ?? null) === (payload.description ?? null)
    );
  }

  private static fromPayload(payload: TransactionPayload) {
    return {
      id: randomUUID(),
      accountId: payload.accountId,
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      description: payload.description ?? null,
      providerTransactionId: null,
      balanceAfter: null,
      failureReason: null,
      idempotencyKey: payload.idempotencyKey ?? null,
      createdAt: new Date(),
    };
  }
}
