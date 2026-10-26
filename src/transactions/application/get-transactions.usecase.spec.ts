import { TransactionStatus } from '../domain/transaction-status.enum';
import { TransactionType } from '../domain/transaction-type.enum';
import { TransactionRepository } from '../domain/transaction.repository';
import {
  DEFAULT_PAGE_LIMIT,
  GetTransactionsUseCase,
  MAX_PAGE_LIMIT,
} from './get-transactions.usecase';

describe('GetTransactionsUseCase', () => {
  let findAll: jest.MockedFunction<TransactionRepository['findAll']>;
  let useCase: GetTransactionsUseCase;

  beforeEach(() => {
    findAll = jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    useCase = new GetTransactionsUseCase({
      save: jest.fn(),
      findAll,
      findByIdempotencyKey: jest.fn(),
    });
  });

  it('aplica default/tope de página y reenvía filtros y cursor', async () => {
    await useCase.execute({});
    expect(findAll).toHaveBeenCalledWith(
      {},
      { cursor: undefined, limit: DEFAULT_PAGE_LIMIT },
    );

    await useCase.execute({ limit: MAX_PAGE_LIMIT + 50 });
    expect(findAll).toHaveBeenLastCalledWith(
      {},
      expect.objectContaining({ limit: MAX_PAGE_LIMIT }),
    );

    findAll.mockResolvedValue({
      items: [],
      nextCursor: 'next-cursor',
    });
    const page = await useCase.execute({
      accountId: 'acc-123456',
      status: TransactionStatus.EXECUTED,
      type: TransactionType.DEBIT,
      cursor: 'current-cursor',
      limit: 5,
    });

    expect(findAll).toHaveBeenLastCalledWith(
      {
        accountId: 'acc-123456',
        status: TransactionStatus.EXECUTED,
        type: TransactionType.DEBIT,
      },
      { cursor: 'current-cursor', limit: 5 },
    );
    expect(page.nextCursor).toBe('next-cursor');
  });
});
