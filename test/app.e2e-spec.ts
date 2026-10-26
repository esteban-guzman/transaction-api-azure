import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import {
  TransactionPageResponse,
  TransactionResponse,
} from '../src/transactions/infrastructure/http/mappers/transaction-response.mapper';

type ErrorBody = {
  statusCode: number;
  code: string;
  message: string | string[];
};

describe('Transaction Execution API (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST CREDIT válido → 201 EXECUTED con los campos del PDF', async () => {
    const accountId = newAccountId();
    const body = asTransaction(
      await request(server)
        .post('/transactions')
        .send(creditBody(accountId, 1500))
        .expect(201),
    );

    expect(body).toMatchObject({
      accountId,
      type: 'CREDIT',
      amount: 1500,
      currency: 'MXN',
      description: 'Transferencia recibida',
      status: 'EXECUTED',
    });
    expect(typeof body.id).toBe('string');
    expect(typeof body.providerTransactionId).toBe('string');
    expect(typeof body.balanceAfter).toBe('number');
    expect(typeof body.createdAt).toBe('string');
  });

  it('POST amount: 1 → 400 sin ejecutar el proveedor', async () => {
    const body = asError(
      await request(server)
        .post('/transactions')
        .send(creditBody(newAccountId(), 1))
        .expect(400),
    );

    expect(body.code).toBe('INVALID_AMOUNT');
  });

  it('POST DEBIT de 10000 → 201 EXECUTED', async () => {
    const body = asTransaction(
      await request(server)
        .post('/transactions')
        .send(debitBody(newAccountId(), 10_000))
        .expect(201),
    );

    expect(body.status).toBe('EXECUTED');
    expect(body.amount).toBe(10_000);
    expect(typeof body.providerTransactionId).toBe('string');
  });

  it('POST DEBIT > 10000 → 400 sin ejecutar el proveedor', async () => {
    const body = asError(
      await request(server)
        .post('/transactions')
        .send(debitBody(newAccountId(), 10_001))
        .expect(400),
    );

    expect(body.code).toBe('AMOUNT_EXCEEDS_LIMIT');
  });

  it('Idempotency-Key: mismo body reusa el id; body distinto → 409', async () => {
    const key = randomUUID();
    const payload = creditBody(newAccountId(), 200);

    const first = asTransaction(
      await request(server)
        .post('/transactions')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201),
    );

    const second = asTransaction(
      await request(server)
        .post('/transactions')
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201),
    );
    expect(second.id).toBe(first.id);

    const conflict = asError(
      await request(server)
        .post('/transactions')
        .set('Idempotency-Key', key)
        .send(creditBody(newAccountId(), 300))
        .expect(409),
    );
    expect(conflict.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('GET filtra por accountId y pagina con cursor', async () => {
    const accountId = newAccountId();

    for (const amount of [110, 120, 130]) {
      await request(server)
        .post('/transactions')
        .send(creditBody(accountId, amount))
        .expect(201);
    }

    const firstPage = asPage(
      await request(server)
        .get('/transactions')
        .query({ accountId, limit: 1 })
        .expect(200),
    );

    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.data[0].accountId).toBe(accountId);
    expect(typeof firstPage.nextCursor).toBe('string');

    const secondPage = asPage(
      await request(server)
        .get('/transactions')
        .query({ accountId, limit: 1, cursor: firstPage.nextCursor })
        .expect(200),
    );

    expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
    expect(secondPage.data[0].accountId).toBe(accountId);
  });

});

function asTransaction(response: Response): TransactionResponse {
  return response.body as TransactionResponse;
}

function asPage(response: Response): TransactionPageResponse {
  return response.body as TransactionPageResponse;
}

function asError(response: Response): ErrorBody {
  return response.body as ErrorBody;
}

function newAccountId(): string {
  return `acc-${randomUUID().slice(0, 8)}`;
}

function creditBody(accountId: string, amount: number) {
  return {
    accountId,
    type: 'CREDIT',
    amount,
    currency: 'MXN',
    description: 'Transferencia recibida',
  };
}

function debitBody(accountId: string, amount: number) {
  return {
    accountId,
    type: 'DEBIT',
    amount,
    currency: 'MXN',
    description: 'Cargo a cuenta',
  };
}
