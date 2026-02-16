export type ErrorSource = 'onerror' | 'unhandledrejection';

export interface CapturedErrorInfo {
  timestamp: number;
  source: ErrorSource;
  message: string;
  stack: string;
  type: string;
  extra?: string;
  canContinue: boolean;
}

export interface ErrorBoundaryOptions {
  onError: (error: CapturedErrorInfo) => void;
}

function toErrorLike(value: unknown): Error | null {
  if (value instanceof Error) {
    return value;
  }
  return null;
}

function toMessage(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error && typeof value.message === 'string') {
    return value.message;
  }
  if (value === null || value === undefined) {
    return 'Unknown error';
  }
  return String(value);
}

function isNonFatalMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('content load fallback') || lower.includes('non-fatal');
}

export class ErrorBoundary {
  private readonly onError: (error: CapturedErrorInfo) => void;
  private installed = false;

  constructor(options: ErrorBoundaryOptions) {
    this.onError = options.onError;
  }

  install(): void {
    if (this.installed) {
      return;
    }
    this.installed = true;
    window.addEventListener('error', this.handleWindowError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  uninstall(): void {
    if (!this.installed) {
      return;
    }
    this.installed = false;
    window.removeEventListener('error', this.handleWindowError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private readonly handleWindowError = (event: ErrorEvent): void => {
    const message = event.message || toMessage(event.error);
    const errorLike = toErrorLike(event.error);
    const stack = errorLike?.stack ?? `${event.filename ?? ''}:${event.lineno ?? 0}:${event.colno ?? 0}`;

    this.onError({
      timestamp: Date.now(),
      source: 'onerror',
      message,
      stack,
      type: errorLike?.name ?? 'Error',
      extra: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      canContinue: isNonFatalMessage(message),
    });
  };

  private readonly handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    const message = toMessage(reason);
    const errorLike = toErrorLike(reason);

    this.onError({
      timestamp: Date.now(),
      source: 'unhandledrejection',
      message,
      stack: errorLike?.stack ?? '',
      type: errorLike?.name ?? 'PromiseRejection',
      extra: reason !== undefined && !(reason instanceof Error) ? String(reason) : undefined,
      canContinue: isNonFatalMessage(message),
    });
  };
}

