import { randomUUID as nodeRandomUUID } from 'node:crypto';

/** expo-crypto's UUID, backed by Node's in tests. */
export const randomUUID = jest.fn(() => nodeRandomUUID());
