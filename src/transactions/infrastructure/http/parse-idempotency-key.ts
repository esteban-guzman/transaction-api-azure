import { BadRequestException } from '@nestjs/common';

import {
  MAX_IDEMPOTENCY_KEY_LENGTH,
  MIN_IDEMPOTENCY_KEY_LENGTH,
} from '../../domain/transaction.constants';

export function parseIdempotencyKey(value?: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    throw new BadRequestException(
      `Idempotency-Key must be between ${MIN_IDEMPOTENCY_KEY_LENGTH} and ${MAX_IDEMPOTENCY_KEY_LENGTH} characters.`,
    );
  }

  return value;
}
