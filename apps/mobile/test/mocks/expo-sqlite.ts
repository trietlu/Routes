/**
 * In-memory stand-in for expo-sqlite's async API. Storage logic is tested
 * against this; it records SQL and returns what tests queue up.
 */
export interface MockDatabase {
  execAsync: jest.Mock;
  runAsync: jest.Mock;
  getAllAsync: jest.Mock;
  getFirstAsync: jest.Mock;
  withTransactionAsync: jest.Mock;
  closeAsync: jest.Mock;
}

export function createMockDatabase(): MockDatabase {
  const db: MockDatabase = {
    execAsync: jest.fn(async () => undefined),
    runAsync: jest.fn(async () => ({ lastInsertRowId: 0, changes: 0 })),
    getAllAsync: jest.fn(async () => []),
    getFirstAsync: jest.fn(async () => null),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    closeAsync: jest.fn(async () => undefined),
  };
  return db;
}

export const openDatabaseAsync = jest.fn(async () => createMockDatabase());
export const openDatabaseSync = jest.fn(() => createMockDatabase());
