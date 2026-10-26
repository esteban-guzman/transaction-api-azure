import type {
  ProviderResponse,
  TransactionPayload,
} from '../domain/transaction.entity';

export const PROVIDER_PORT = Symbol('PROVIDER_PORT');

export class ProviderUnavailableError extends Error {
  readonly code = 'PROVIDER_UNAVAILABLE';

  constructor(
    message: string,
    readonly retryable: boolean,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}

export interface ProviderPort {
  execute(payload: TransactionPayload): Promise<ProviderResponse>;
}
