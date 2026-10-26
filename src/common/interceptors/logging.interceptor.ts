import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.log(request, response.statusCode, Date.now() - startedAt),
        error: (error: { status?: number }) =>
          this.log(request, error?.status ?? 500, Date.now() - startedAt),
      }),
    );
  }

  private log(request: Request, statusCode: number, elapsedMs: number): void {
    this.logger.log(
      `${request.method} ${request.originalUrl} ${statusCode} - ${elapsedMs}ms`,
    );
  }
}
