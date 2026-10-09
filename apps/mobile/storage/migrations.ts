import { type SqlDatabase } from './database';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Numbered schema migrations (technical design § Data model and storage).
 * Append new ones; never edit a shipped migration.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: '001_init',
    sql: `
      CREATE TABLE places (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('recent', 'home', 'work')),
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        place_id TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        last_used_at INTEGER NOT NULL
      );
      CREATE INDEX places_kind_last_used ON places (kind, last_used_at DESC);
      CREATE TABLE vehicle_profile (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        mpg REAL NOT NULL,
        fuel_type TEXT NOT NULL,
        price_per_gallon REAL NOT NULL,
        is_user_set INTEGER NOT NULL
      );
      CREATE TABLE preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
];

/**
 * Brings the schema up to date. The applied version lives in SQLite's
 * `user_version`, so running this again is a no-op (APP-STORE-01).
 */
export async function migrate(
  db: SqlDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    await db.transaction(async () => {
      await db.exec(migration.sql);
      // PRAGMA takes no bound parameters; the version is a trusted integer.
      await db.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
    version = migration.version;
  }
  return version;
}
