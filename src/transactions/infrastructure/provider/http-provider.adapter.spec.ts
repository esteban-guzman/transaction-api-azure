import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';

import type {
  ProviderApproved,
  TransactionPayload,
} from '../../domain/transaction.entity';
import { TransactionType } from '../../domain/transaction-type.enum';
import { HttpProviderAdapter } from './http-provider.adapter';

type ProviderHttpApproved = ProviderApproved & { executedAt: string };

describe('HttpProviderAdapter', () => {
  const payload: TransactionPayload = {
    accountId: 'acc-123456',
    type: TransactionType.CREDIT,
    amount: 1500,
    currency: 'MXN',
  };

  const httpApproved: ProviderHttpApproved = {
    status: 'APPROVED',
    transactionId: 'txn-789',
    balance: 5500,
    executedAt: '2025-03-15T10:30:00Z',
  };

  let http: { post: jest.Mock };
  let adapter: HttpProviderAdapter;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(global, 'setTimeout').mockImplementation(((
      callback: () => void,
    ) => {
      callback();
      return 0;
    }) as typeof setTimeout);

    http = { post: jest.fn() };
    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'provider.baseUrl') {
          return 'http://provider.test';
        }
        if (key === 'provider.timeoutMs') {
          return 3000;
        }
        throw new Error(`unexpected key: ${key}`);
      }),
    };

    adapter = new HttpProviderAdapter(
      http as unknown as HttpService,
      config as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mapea APPROVED en el primer POST', async () => {
    http.post.mockReturnValue(of(axiosOk(httpApproved)));

    const result = await adapter.execute(payload);

    expect(result).toEqual({
      status: 'APPROVED',
      transactionId: 'txn-789',
      balance: 5500,
    });
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledWith(
      'http://provider.test/provider/v1/execute',
      {
        accountId: payload.accountId,
        type: payload.type,
        amount: payload.amount,
        currency: payload.currency,
      },
      { timeout: 3000 },
    );
  });

  it('devuelve REJECTED de negocio con un solo POST', async () => {
    http.post.mockReturnValue(
      throwError(() =>
        axiosFailure({
          status: 422,
          data: {
            status: 'REJECTED',
            code: 'INSUFFICIENT_FUNDS',
            message: 'Insufficient funds',
          },
        }),
      ),
    );

    await expect(adapter.execute(payload)).resolves.toEqual({
      status: 'REJECTED',
      code: 'INSUFFICIENT_FUNDS',
      message: 'Insufficient funds',
    });
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('reintenta un 5xx hasta 3 veces y no reintenta un 4xx', async () => {
    http.post.mockReturnValue(
      throwError(() =>
        axiosFailure({ status: 500, data: { error: 'boom' }, message: '500' }),
      ),
    );

    await expect(adapter.execute(payload)).rejects.toMatchObject({
      name: 'ProviderUnavailableError',
      retryable: true,
    });
    expect(http.post).toHaveBeenCalledTimes(3);

    http.post.mockClear();
    http.post.mockReturnValue(
      throwError(() =>
        axiosFailure({
          status: 400,
          data: { error: 'bad request' },
          message: 'Request failed with status code 400',
        }),
      ),
    );

    await expect(adapter.execute(payload)).rejects.toMatchObject({
      name: 'ProviderUnavailableError',
      retryable: false,
    });
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});

function axiosOk(
  data: ProviderHttpApproved,
): AxiosResponse<ProviderHttpApproved> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: {} } as AxiosResponse['config'],
  };
}

function axiosFailure(params: {
  code?: string;
  message?: string;
  status?: number;
  data?: unknown;
}): AxiosError {
  const error = new AxiosError(params.message ?? 'error');
  error.code = params.code;

  if (params.status !== undefined) {
    error.response = {
      status: params.status,
      data: params.data,
      statusText: String(params.status),
      headers: {},
      config: { headers: {} } as AxiosResponse['config'],
    };
  }

  return error;
}
