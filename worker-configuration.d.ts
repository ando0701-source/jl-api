/// <reference lib="dom" />

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  error?: string;
  meta?: {
    changes?: number;
    duration?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
    size_after?: number;
    [key: string]: unknown;
  };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
}
