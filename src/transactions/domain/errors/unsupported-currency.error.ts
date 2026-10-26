export class UnsupportedCurrencyError extends Error {
  readonly code = 'UNSUPPORTED_CURRENCY';

  constructor(currency: string, supported: string) {
    super(
      `Currency ${currency} is not supported. Only ${supported} transactions are accepted.`,
    );
    this.name = 'UnsupportedCurrencyError';
  }
}
