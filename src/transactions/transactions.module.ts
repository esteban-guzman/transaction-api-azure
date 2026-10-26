import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExecuteTransactionUseCase } from './application/execute-transaction.usecase';
import { GetTransactionsUseCase } from './application/get-transactions.usecase';
import { PROVIDER_PORT } from './application/provider.port';
import { TRANSACTION_REPOSITORY } from './domain/transaction.repository';
import { TransactionsController } from './infrastructure/http/transactions.controller';
import { TransactionOrmEntity } from './infrastructure/persistence/transaction.orm-entity';
import { TransactionRepositoryAdapter } from './infrastructure/persistence/transaction.repository.adapter';
import { CircuitBreakerProvider } from './infrastructure/provider/circuit-breaker.provider';
import { HttpProviderAdapter } from './infrastructure/provider/http-provider.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([TransactionOrmEntity]), HttpModule],
  controllers: [TransactionsController],
  providers: [
    ExecuteTransactionUseCase,
    GetTransactionsUseCase,
    HttpProviderAdapter,
    { provide: TRANSACTION_REPOSITORY, useClass: TransactionRepositoryAdapter },
    {
      provide: PROVIDER_PORT,
      useFactory: (httpProvider: HttpProviderAdapter) => {
        return new CircuitBreakerProvider(httpProvider);
      },
      inject: [HttpProviderAdapter],
    },
  ],
})
export class TransactionsModule {}
