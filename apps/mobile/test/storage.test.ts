import { DEFAULT_VEHICLE } from '@routes/routing-core';
import { createMockDatabase } from './mocks/expo-sqlite';
import { createTestDatabase } from './nodeSqlite';
import {
  MAX_RECENTS,
  MIGRATIONS,
  type PlaceInput,
  createPlacesRepo,
  createPreferencesRepo,
  createStorage,
  createVehicleRepo,
  migrate,
  openStorage,
} from '../storage';
import { wrapExpoDatabase } from '../storage/expoDatabase';

const place = (n: number, overrides: Partial<PlaceInput> = {}): PlaceInput => ({
  name: `Place ${n}`,
  address: `${n} Test Way`,
  placeId: `place-${n}`,
  lat: 39.7 + n / 1000,
  lng: -104.9 - n / 1000,
  ...overrides,
});

async function setup() {
  const db = createTestDatabase();
  await migrate(db);
  let clock = 1_000;
  const tick = () => (clock += 1_000);
  return { db, places: createPlacesRepo(db, tick), tick };
}

describe('storage', () => {
  it('APP-STORE-01: migrations run on an empty database and are idempotent', async () => {
    const db = createTestDatabase();
    expect(await migrate(db)).toBe(MIGRATIONS.length);
    const tables = await db.getAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(['places', 'preferences', 'vehicle_profile']);
    await createPlacesRepo(db).addRecent(place(1));

    expect(await migrate(db)).toBe(MIGRATIONS.length);
    expect(await createPlacesRepo(db).listRecents()).toHaveLength(1);
    expect((await db.getFirst<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(
      1,
    );
  });

  it('APP-STORE-01: a failing migration rolls back and leaves the version unchanged', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const broken = [
      ...MIGRATIONS,
      { version: 2, name: '002_broken', sql: 'CREATE TABLE x (a); NOT SQL' },
    ];
    await expect(migrate(db, broken)).rejects.toThrow();
    expect((await db.getFirst<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(
      1,
    );
    expect(await db.getFirst("SELECT name FROM sqlite_master WHERE name = 'x'")).toBeNull();
  });

  it('APP-STORE-02: adding a recent upserts by placeId, updates lastUsedAt, orders most recent first, trims to 10', async () => {
    const { places } = await setup();
    for (let n = 1; n <= 12; n++) await places.addRecent(place(n));
    let recents = await places.listRecents();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents.map((p) => p.placeId)).toEqual(
      [12, 11, 10, 9, 8, 7, 6, 5, 4, 3].map((n) => `place-${n}`),
    );

    // Re-adding place 5 moves it to the top without duplicating it, and refreshes its details.
    const before = recents.find((p) => p.placeId === 'place-5')!;
    const again = await places.addRecent(place(5, { name: 'Place 5 (renamed)' }));
    expect(again.lastUsedAt).toBeGreaterThan(before.lastUsedAt);
    recents = await places.listRecents();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0]).toMatchObject({
      placeId: 'place-5',
      name: 'Place 5 (renamed)',
      kind: 'recent',
    });
    expect(recents.filter((p) => p.placeId === 'place-5')).toHaveLength(1);
  });

  it('APP-STORE-02: a place without a place ID is matched by its coordinates', async () => {
    const { places } = await setup();
    await places.addRecent(place(1, { placeId: null }));
    await places.addRecent(place(1, { placeId: null, name: 'Same spot' }));
    await places.addRecent(place(2, { placeId: null }));
    const recents = await places.listRecents();
    expect(recents.map((p) => p.name)).toEqual(['Place 2', 'Same spot']);
    expect(recents[1]!.placeId).toBeNull();
  });

  it('APP-STORE-03: clear recents deletes recents only; Home and Work remain', async () => {
    const { places } = await setup();
    await places.setSaved('home', place(100));
    await places.setSaved('work', place(200));
    for (let n = 1; n <= 3; n++) await places.addRecent(place(n));
    await places.clearRecents();
    expect(await places.listRecents()).toEqual([]);
    expect(await places.getSaved('home')).toMatchObject({ placeId: 'place-100', kind: 'home' });
    expect(await places.getSaved('work')).toMatchObject({ placeId: 'place-200', kind: 'work' });
  });

  it('saved Home and Work never count toward or get trimmed by the recents limit', async () => {
    const { places } = await setup();
    await places.setSaved('home', place(1));
    await places.setSaved('work', place(2));
    // The same places also used as recents, plus many more.
    for (let n = 1; n <= 15; n++) await places.addRecent(place(n));
    expect(await places.listRecents()).toHaveLength(MAX_RECENTS);
    expect(await places.getSaved('home')).toMatchObject({ placeId: 'place-1' });
    expect(await places.getSaved('work')).toMatchObject({ placeId: 'place-2' });
    expect((await places.listRecents()).every((p) => p.kind === 'recent')).toBe(true);
  });

  it('APP-STORE-04: set, replace and remove Home and Work', async () => {
    const { places } = await setup();
    expect(await places.getSaved('home')).toBeNull();
    const home = await places.setSaved('home', place(1));
    expect(home).toMatchObject({ id: 'home', kind: 'home', name: 'Place 1' });
    expect(await places.getSaved('home')).toEqual(home);

    await places.setSaved('home', place(2));
    expect(await places.getSaved('home')).toMatchObject({ placeId: 'place-2', name: 'Place 2' });
    await places.setSaved('work', place(3));

    await places.removeSaved('home');
    expect(await places.getSaved('home')).toBeNull();
    expect(await places.getSaved('work')).toMatchObject({ placeId: 'place-3' });
  });

  it('APP-STORE-05: vehicle defaults on first read; save persists and sets isUserSet', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const vehicle = createVehicleRepo(db);
    expect(await vehicle.get()).toEqual({ ...DEFAULT_VEHICLE, isUserSet: false });

    const saved = await vehicle.save({ mpg: 40, fuelType: 'premium', pricePerGallon: 4 });
    expect(saved).toEqual({ mpg: 40, fuelType: 'premium', pricePerGallon: 4, isUserSet: true });
    expect(await createVehicleRepo(db).get()).toEqual(saved);

    await vehicle.save({ mpg: 33.5, fuelType: 'diesel', pricePerGallon: 4.25 });
    expect(await vehicle.get()).toEqual({
      mpg: 33.5,
      fuelType: 'diesel',
      pricePerGallon: 4.25,
      isUserSet: true,
    });
    expect(await db.getAll('SELECT * FROM vehicle_profile')).toHaveLength(1);
  });

  it('APP-STORE-06: lastMode defaults to fastest and persists across reloads', async () => {
    const db = createTestDatabase();
    await migrate(db);
    expect(await createPreferencesRepo(db).getLastMode()).toBe('fastest');
    await createPreferencesRepo(db).setLastMode('cheapest');
    expect(await createPreferencesRepo(db).getLastMode()).toBe('cheapest');
    await createPreferencesRepo(db).setLastMode('fastest');
    expect(await createPreferencesRepo(db).getLastMode()).toBe('fastest');
  });

  it('prompt flags default to false and persist', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const prefs = createPreferencesRepo(db);
    expect(await prefs.getLocationPromptShown()).toBe(false);
    expect(await prefs.getCheapestVehiclePromptShown()).toBe(false);
    await prefs.setLocationPromptShown(true);
    await prefs.setCheapestVehiclePromptShown(true);
    const reloaded = createPreferencesRepo(db);
    expect(await reloaded.getLocationPromptShown()).toBe(true);
    expect(await reloaded.getCheapestVehiclePromptShown()).toBe(true);
    await reloaded.setLocationPromptShown(false);
    expect(await prefs.getLocationPromptShown()).toBe(false);
  });

  it('APP-STORE-07: deviceId is generated once and stays stable', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const ids = ['3b241101-e2bb-4255-8caf-4136c566a962', '9c5b94b1-35ad-49bb-b118-8e8fc24abf80'];
    const generate = jest.fn(() => ids.shift()!);
    const first = await createPreferencesRepo(db, generate).getDeviceId();
    expect(first).toBe('3b241101-e2bb-4255-8caf-4136c566a962');
    expect(await createPreferencesRepo(db, generate).getDeviceId()).toBe(first);
    expect(await createPreferencesRepo(db, generate).getDeviceId()).toBe(first);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('APP-STORE-07: the default generator produces a UUID', async () => {
    const db = createTestDatabase();
    await migrate(db);
    const id = await createPreferencesRepo(db).getDeviceId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('createStorage migrates and wires the repositories', async () => {
    const storage = await createStorage(createTestDatabase());
    await storage.places.addRecent(place(1));
    expect(await storage.places.listRecents()).toHaveLength(1);
    expect((await storage.vehicle.get()).isUserSet).toBe(false);
    expect(await storage.preferences.getLastMode()).toBe('fastest');
  });

  it('the expo-sqlite adapter forwards to the async API', async () => {
    const native = createMockDatabase();
    native.getFirstAsync.mockResolvedValueOnce({ user_version: 0 });
    const db = wrapExpoDatabase(native as never);
    await db.exec('SELECT 1');
    await db.run('INSERT INTO t VALUES (?)', [1]);
    await db.run('DELETE FROM t');
    await db.getAll('SELECT * FROM t WHERE a = ?', ['x']);
    expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 0 });
    await db.transaction(async () => undefined);
    expect(native.execAsync).toHaveBeenCalledWith('SELECT 1');
    expect(native.runAsync).toHaveBeenCalledWith('INSERT INTO t VALUES (?)', [1]);
    expect(native.runAsync).toHaveBeenCalledWith('DELETE FROM t', []);
    expect(native.getAllAsync).toHaveBeenCalledWith('SELECT * FROM t WHERE a = ?', ['x']);
    expect(native.withTransactionAsync).toHaveBeenCalled();

    // openStorage opens routes.db through expo-sqlite and migrates it.
    const storage = await openStorage();
    expect(storage.places).toBeDefined();
    const { openDatabaseAsync } = jest.requireMock('expo-sqlite') as {
      openDatabaseAsync: jest.Mock;
    };
    expect(openDatabaseAsync).toHaveBeenCalledWith('routes.db');
  });
});
