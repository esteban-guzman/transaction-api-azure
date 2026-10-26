import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ExecuteTransactionUseCase } from '../../application/execute-transaction.usecase';
import { GetTransactionsUseCase } from '../../application/get-transactions.usecase';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { parseIdempotencyKey } from './parse-idempotency-key';
import {
  TransactionPageResponse,
  TransactionResponse,
  toTransactionPageResponse,
  toTransactionResponse,
} from './mappers/transaction-response.mapper';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly executeTransaction: ExecuteTransactionUseCase,
    private readonly getTransactions: GetTransactionsUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Execute a transaction against the external provider',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      '5 to 36 characters. If the same body is resent with the same key, the persisted transaction is returned without calling the provider again.',
  })
  @ApiResponse({ status: 201, type: TransactionResponse })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or business rule not met',
  })
  @ApiResponse({
    status: 409,
    description:
      'The Idempotency-Key was already used with a different request',
  })
  @ApiResponse({
    status: 502,
    description: 'The external provider responded with a failure',
  })
  @ApiResponse({
    status: 503,
    description: 'The external provider is unavailable',
  })
  async create(
    @Body() dto: CreateTransactionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<TransactionResponse> {
    const transaction = await this.executeTransaction.execute({
      ...dto,
      idempotencyKey: parseIdempotencyKey(idempotencyKey),
    });

    return toTransactionResponse(transaction);
  }

  @Get()
  @ApiOperation({
    summary: 'List transactions with filters and cursor pagination',
  })
  @ApiResponse({ status: 200, type: TransactionPageResponse })
  async find(
    @Query() query: QueryTransactionsDto,
  ): Promise<TransactionPageResponse> {
    const page = await this.getTransactions.execute(query);

    return toTransactionPageResponse(page);
  }
}
