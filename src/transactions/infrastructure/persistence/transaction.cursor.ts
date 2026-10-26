const CURSOR_SEPARATOR = '|';

export class InvalidCursorError extends Error {
  readonly code = 'INVALID_CURSOR';

  constructor(cursor: string) {
    super(`Cursor "${cursor}" is invalid.`);
    this.name = 'InvalidCursorError';
  }
}

export function encodeCursor(item: { createdAt: Date; id: string }): string {
  const encode = `${item.createdAt.toISOString()}${CURSOR_SEPARATOR}${item.id}`;
  return Buffer.from(encode, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): {
  createdAt: string;
  id: string;
} {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const [createdAt, id] = decoded.split(CURSOR_SEPARATOR);

  if (!createdAt || !id) {
    throw new InvalidCursorError(cursor);
  }

  return { createdAt, id };
}
