import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { type SqlDatabase, type SqlValue } from './database';

/** The app's database file. */
export const DATABASE_NAME = 'routes.db';

/** `SqlDatabase` over expo-sqlite's async API. */
export function wrapExpoDatabase(db: SQLiteDatabase): SqlDatabase {
  const params = (values?: readonly SqlValue[]): SqlValue[] => [...(values ?? [])];
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, values) => {
      await db.runAsync(sql, params(values));
    },
    getAll: (sql, values) => db.getAllAsync(sql, params(values)),
    getFirst: (sql, values) => db.getFirstAsync(sql, params(values)),
    transaction: (task) => db.withTransactionAsync(task),
  };
}

export async function openExpoDatabase(name: string = DATABASE_NAME): Promise<SqlDatabase> {
  return wrapExpoDatabase(await openDatabaseAsync(name));
}
