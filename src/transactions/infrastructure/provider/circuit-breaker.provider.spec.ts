import {
  ProviderPort,
  ProviderUnavailableError,
} from '../../application/provider.port';
import { TransactionType } from '../../domain/transaction-type.enum';
import type {
  ProviderRejected,
  TransactionPayload,
} from '../../domain/transaction.entity';
import { CircuitBreakerProvider } from './circuit-breaker.provider';

describe('CircuitBreakerProvider', () => {
  const payload: TransactionPayload = {
    accountId: 'acc-123456',
    type: TransactionType.CREDIT,
    amount: 1500,
    currency: 'MXN',
  };

  const rejected: ProviderRejected = {
    status: 'REJECTED',
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds',
  };

  let innerExecute: jest.MockedFunction<ProviderPort['execute']>;
  let breaker: CircuitBreakerProvider;

  beforeEach(() => {
    innerExecute = jest.fn();
    breaker = new CircuitBreakerProvider({ execute: innerExecute });
  });

  it('no abre el circuito ante REJECTED de negocio', async () => {
    innerExecute.mockResolvedValue(rejected);

    for (let attempt = 0; attempt < 6; attempt++) {
      await expect(breaker.execute(payload)).resolves.toEqual(rejected);
    }

    expect(innerExecute).toHaveBeenCalledTimes(6);
  });

  it('abre el circuito tras 5 errores retryable y deja de llamar al inner', async () => {
    innerExecute.mockRejectedValue(
      new ProviderUnavailableError(
        'The provider did not respond within 3000ms.',
        true,
      ),
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(breaker.execute(payload)).rejects.toBeInstanceOf(
        ProviderUnavailableError,
      );
    }

    await expect(breaker.execute(payload)).rejects.toMatchObject({
      message: 'The provider circuit is open.',
      retryable: true,
    });
    expect(innerExecute).toHaveBeenCalledTimes(5);
  });
});
