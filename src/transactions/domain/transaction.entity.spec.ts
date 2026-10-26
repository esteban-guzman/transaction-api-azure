import { AmountExceedsLimitError } from './errors/amount-exceeds-limit.error';
import { InvalidAmountError } from './errors/invalid-amount.error';
import { UnsupportedCurrencyError } from './errors/unsupported-currency.error';
import { Transaction } from './transaction.entity';
import { TransactionStatus } from './transaction-status.enum';
import { TransactionType } from './transaction-type.enum';

describe('Transaction', () => {
  const validInput = {
    accountId: 'acc-123456',
    type: TransactionType.CREDIT,
    amount: 1500,
    currency: 'MXN',
  };

  it('permite un CREDIT sobre el tope de DEBIT y un DEBIT igual al límite', () => {
    expect(() =>
      Transaction.validatePayload({ ...validInput, amount: 50_000 }),
    ).not.toThrow();
    expect(() =>
      Transaction.validatePayload({
        ...validInput,
        type: TransactionType.DEBIT,
        amount: 10_000,
      }),
    ).not.toThrow();
  });

  it('rechaza amount ≤ 1, moneda distinta de MXN y DEBIT sobre 10000', () => {
    expect(() =>
      Transaction.validatePayload({ ...validInput, amount: 1 }),
    ).toThrow(InvalidAmountError);
    expect(() =>
      Transaction.validatePayload({ ...validInput, currency: 'USD' }),
    ).toThrow(UnsupportedCurrencyError);
    expect(() =>
      Transaction.validatePayload({
        ...validInput,
        type: TransactionType.DEBIT,
        amount: 10_000.01,
      }),
    ).toThrow(AmountExceedsLimitError);
  });

  it('hasSamePayload acepta el mismo payload y rechaza si cambia un campo', () => {
    const transaction = new Transaction({
      id: 'tx-1',
      accountId: 'acc-123456',
      type: TransactionType.CREDIT,
      amount: 1500,
      currency: 'MXN',
      description: 'Transferencia recibida',
      status: TransactionStatus.EXECUTED,
      providerTransactionId: 'txn-789',
      balanceAfter: 5500,
      failureReason: null,
      idempotencyKey: 'key-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const samePayload = {
      accountId: 'acc-123456',
      type: TransactionType.CREDIT,
      amount: 1500,
      currency: 'MXN',
      description: 'Transferencia recibida',
    };

    expect(transaction.hasSamePayload(samePayload)).toBe(true);
    expect(transaction.hasSamePayload({ ...samePayload, amount: 2000 })).toBe(
      false,
    );
  });

  it('fromResponse arma EXECUTED o REJECTED según el proveedor', () => {
    const approved = Transaction.fromResponse(validInput, {
      status: 'APPROVED',
      transactionId: 'txn-789',
      balance: 5500,
    });
    expect(approved.status).toBe(TransactionStatus.EXECUTED);
    expect(approved.providerTransactionId).toBe('txn-789');
    expect(approved.balanceAfter).toBe(5500);

    const rejected = Transaction.fromResponse(validInput, {
      status: 'REJECTED',
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient funds',
    });
    expect(rejected.status).toBe(TransactionStatus.REJECTED);
    expect(rejected.failureReason).toBe('Insufficient funds');
    expect(rejected.providerTransactionId).toBeNull();
  });
});
