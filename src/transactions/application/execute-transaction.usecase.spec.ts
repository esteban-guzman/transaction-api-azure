import { TransactionStatus } from '../domain/transaction-status.enum';
import { TransactionType } from '../domain/transaction-type.enum';
import {
  Transaction,
  type TransactionPayload,
} from '../domain/transaction.entity';
import { TransactionRepository } from '../domain/transaction.repository';
import { IdempotencyConflictError } from '../domain/errors/idempotency-conflict.error';
import { InvalidAmountError } from '../domain/errors/invalid-amount.error';
import { ExecuteTransactionUseCase } from './execute-transaction.usecase';
import { ProviderPort, ProviderUnavailableError } from './provider.port';

describe('ExecuteTransactionUseCase', () => {
  let executeProvider: jest.MockedFunction<ProviderPort['execute']>;
  let save: jest.MockedFunction<TransactionRepository['save']>;
  let findByIdempotencyKey: jest.MockedFunction<
    TransactionRepository['findByIdempotencyKey']
  >;
  let useCase: ExecuteTransactionUseCase;

  const payload: TransactionPayload = {
    accountId: 'acc-123456',
    type: TransactionType.CREDIT,
    amount: 1500,
    currency: 'MXN',
    description: 'Transferencia recibida',
  };

  const transactions = new Transaction({
    id: 'tx-existing',
    accountId: payload.accountId,
    type: payload.type,
    amount: payload.amount,
    currency: payload.currency,
    description: payload.description ?? null,
    status: TransactionStatus.EXECUTED,
    providerTransactionId: 'txn-789',
    balanceAfter: 5500,
    failureReason: null,
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-08-14'),
  });

  beforeEach(() => {
    executeProvider = jest.fn();
    save = jest.fn((transaction: Transaction) => Promise.resolve(transaction));
    findByIdempotencyKey = jest.fn().mockResolvedValue(null);
    useCase = new ExecuteTransactionUseCase(
      { execute: executeProvider },
      { save, findAll: jest.fn(), findByIdempotencyKey },
    );
  });

  it('persiste EXECUTED cuando el proveedor aprueba', async () => {
    executeProvider.mockResolvedValue({
      status: 'APPROVED',
      transactionId: 'txn-789',
      balance: 5500,
    });

    const result = await useCase.execute(payload);

    expect(result.status).toBe(TransactionStatus.EXECUTED);
    expect(result.balanceAfter).toBe(5500);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('persiste REJECTED cuando el proveedor rechaza por negocio', async () => {
    executeProvider.mockResolvedValue({
      status: 'REJECTED',
      code: 'INSUFFICIENT_FUNDS',
      message: 'The account does not have enough balance',
    });

    const result = await useCase.execute(payload);

    expect(result.status).toBe(TransactionStatus.REJECTED);
    expect(result.failureReason).toBe(
      'The account does not have enough balance',
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('persiste FAILED y relanza cuando el proveedor no está disponible', async () => {
    executeProvider.mockRejectedValue(
      new ProviderUnavailableError(
        'The provider did not respond within 3000ms.',
        true,
      ),
    );

    await expect(useCase.execute(payload)).rejects.toThrow(
      ProviderUnavailableError,
    );

    expect(save.mock.calls[0][0].status).toBe(TransactionStatus.FAILED);
  });

  it('no llama al proveedor si falla una regla de negocio', async () => {
    await expect(useCase.execute({ ...payload, amount: 1 })).rejects.toThrow(
      InvalidAmountError,
    );

    expect(executeProvider).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('con la misma clave reusa la persistida o rechaza si el payload cambió', async () => {
    findByIdempotencyKey.mockResolvedValue(transactions);

    const replay = await useCase.execute({
      ...payload,
      idempotencyKey: 'key-1',
    });
    expect(replay.id).toBe(transactions.id);
    expect(executeProvider).not.toHaveBeenCalled();

    await expect(
      useCase.execute({
        ...payload,
        amount: 2000,
        idempotencyKey: 'key-1',
      }),
    ).rejects.toThrow(IdempotencyConflictError);
  });
});
