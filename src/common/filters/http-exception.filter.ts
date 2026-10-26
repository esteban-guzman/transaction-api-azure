import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AmountExceedsLimitError } from '../../transactions/domain/errors/amount-exceeds-limit.error';
import { IdempotencyConflictError } from '../../transactions/domain/errors/idempotency-conflict.error';
import { InvalidAmountError } from '../../transactions/domain/errors/invalid-amount.error';
import { UnsupportedCurrencyError } from '../../transactions/domain/errors/unsupported-currency.error';
import { ProviderUnavailableError } from '../../transactions/application/provider.port';
import { InvalidCursorError } from '../../transactions/infrastructure/persistence/transaction.cursor';

interface ErrorBody {
  statusCode: HttpStatus;
  code: string;
  message: string | string[];
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const body = this.toErrorBody(exception);

    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.code}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(body.statusCode).json({
      ...body,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (
      exception instanceof InvalidAmountError ||
      exception instanceof UnsupportedCurrencyError ||
      exception instanceof AmountExceedsLimitError ||
      exception instanceof InvalidCursorError
    ) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof IdempotencyConflictError) {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof ProviderUnavailableError) {
      return {
        statusCode: exception.retryable
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.BAD_GATEWAY,
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ??
            exception.message);

      const status = exception.getStatus();

      return {
        statusCode: status,
        code: this.httpErrorCode(status),
        message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    };
  }

  private httpErrorCode(status: HttpStatus): string {
    return status === HttpStatus.BAD_REQUEST
      ? 'VALIDATION_ERROR'
      : `HTTP_${status}`;
  }
}
