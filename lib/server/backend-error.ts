import 'server-only';

export type BackendFailureKind =
  | 'configuration'
  | 'connection'
  | 'timeout'
  | 'upstream'
  | 'invalid-response';

export class BackendUnavailableError extends Error {
  readonly kind: BackendFailureKind;
  readonly statusCode?: number;
  readonly raw?: string;

  constructor(
    message: string,
    options: {
      kind: BackendFailureKind;
      statusCode?: number;
      raw?: string;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = 'BackendUnavailableError';
    this.kind = options.kind;
    this.statusCode = options.statusCode;
    this.raw = options.raw;
  }
}

export function isBackendUnavailableError(error: unknown): error is BackendUnavailableError {
  return error instanceof BackendUnavailableError;
}
