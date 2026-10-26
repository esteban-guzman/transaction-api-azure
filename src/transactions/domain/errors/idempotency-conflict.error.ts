export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';

  constructor(idempotencyKey: string) {
    super(
      `Idempotency-Key "${idempotencyKey}" was already used with a different request.`,
    );
    this.name = 'IdempotencyConflictError';
  }
}
