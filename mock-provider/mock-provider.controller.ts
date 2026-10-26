import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

const STARTING_BALANCE = 10_000;

interface ExecuteRequest {
  accountId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
}

@Controller('provider/v1')
export class MockProviderController {
  @Post('execute')
  execute(@Body() body: ExecuteRequest, @Res() res: Response): void {
    if (body.type === 'DEBIT' && body.amount > STARTING_BALANCE) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
        status: 'REJECTED',
        code: 'INSUFFICIENT_FUNDS',
        message:
          'The account does not have enough balance to complete the transaction',
      });
      return;
    }

    const amountChange = body.type === 'CREDIT' ? body.amount : -body.amount;

    res.status(HttpStatus.OK).json({
      transactionId: `txn-${randomUUID().slice(0, 8)}`,
      status: 'APPROVED',
      balance: Number((STARTING_BALANCE + amountChange).toFixed(2)),
      executedAt: new Date().toISOString(),
    });
  }
}
