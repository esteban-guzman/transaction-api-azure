export class InvalidAmountError extends Error {
  readonly code = 'INVALID_AMOUNT';

  constructor(amount: number, minimum: number) {
    super(`Amount ${amount} is invalid: it must be greater than ${minimum}.`);
    this.name = 'InvalidAmountError';
  }
}
