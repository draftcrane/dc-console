/**
 * Global error store — ring buffer of the last 5 client-side errors.
 *
 * Captures unhandled errors (window.onerror) and unhandled promise rejections
 * (unhandledrejection). Used by useFeedbackContext to auto-attach recent
 * errors to feedback submissions so users never have to describe stack traces.
 *
 * The store is a plain module singleton (no React state) to ensure errors
 * are captured regardless of which component tree is mounted.
 *
 * @module error-store
 * @see {@link ../hooks/use-feedback-context.ts}
 */

const MAX_ERRORS = 5;

export interface CapturedError {
  /** Error message */
  message: string;
  /** Source file (if available from onerror) */
  source?: string;
  /** Line number (if available from onerror) */
  line?: number;
  /** Column number (if available from onerror) */
  column?: number;
  /** ISO 8601 timestamp of when the error was captured */
  timestamp: string;
}

/** Ring buffer of recent errors, newest last. */
const errors: CapturedError[] = [];

/** Whether listeners have been installed. */
let initialized = false;

/**
 * Push an error into the ring buffer.
 * Oldest entries are evicted when the buffer exceeds MAX_ERRORS.
 */
function pushError(entry: CapturedError): void {
  errors.push(entry);
  if (errors.length > MAX_ERRORS) {
    errors.shift();
  }
}

/**
 * Return a snapshot (shallow copy) of the current error buffer.
 * Safe to serialize — no circular references.
 */
export function getRecentErrors(): CapturedError[] {
  return [...errors];
}

/**
 * Install global error listeners (window.onerror + unhandledrejection).
 * Safe to call multiple times — listeners are only installed once.
 * Must be called in a browser environment (guards against SSR).
 */
export function initErrorStore(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  initialized = true;

  window.addEventListener("error", (event: ErrorEvent) => {
    pushError({
      message: event.message || "Unknown error",
      source: event.filename || undefined,
      line: event.lineno || undefined,
      column: event.colno || undefined,
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    let message = "Unhandled promise rejection";

    if (reason instanceof Error) {
      message = reason.message;
    } else if (typeof reason === "string") {
      message = reason;
    } else if (reason != null) {
      try {
        message = String(reason);
      } catch {
        // Keep the default message
      }
    }

    pushError({
      message,
      timestamp: new Date().toISOString(),
    });
  });
}
