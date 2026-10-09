import { DatabaseSync } from 'node:sqlite';
import { type SqlDatabase } from '../storage/database';

/**
 * `SqlDatabase` over Node's built-in SQLite (in-memory), so repository logic
 * is tested against real SQLite without the native expo-sqlite module.
 */
export function createTestDatabase(): SqlDatabase & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;
  return {
    raw,
    exec: async (sql) => {
      raw.exec(sql);
    },
    run: async (sql, params = []) => {
      raw.prepare(sql).run(...params);
    },
    getAll: async <T>(sql: string, params: readonly (string | number | null)[] = []) =>
      raw
        .prepare(sql)
        .all(...params)
        .map((row) => plain<T>(row)),
    getFirst: async <T>(sql: string, params: readonly (string | number | null)[] = []) => {
      const row = raw.prepare(sql).get(...params);
      return row === undefined ? null : plain<T>(row);
    },
    transaction: async (task) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
