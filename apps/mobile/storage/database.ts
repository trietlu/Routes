/** A bound SQL parameter. */
export type SqlValue = string | number | null;

/**
 * The small slice of SQLite the repositories use. The app backs it with
 * expo-sqlite (`expoDatabase.ts`); tests back it with Node's built-in SQLite,
 * so repository logic runs without the native module.
 */
export interface SqlDatabase {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
  getAll<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  getFirst<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  transaction(task: () => Promise<void>): Promise<void>;
}
