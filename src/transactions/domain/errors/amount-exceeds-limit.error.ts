import { TransactionType } from '../transaction-type.enum';

export class AmountExceedsLimitError extends Error {
  readonly code = 'AMOUNT_EXCEEDS_LIMIT';

  constructor(type: TransactionType, amount: number, limit: number) {
    super(
      `Amount ${amount} exceeds the ${limit} limit per ${type} transaction.`,
    );
    this.name = 'AmountExceedsLimitError';
  }
}
