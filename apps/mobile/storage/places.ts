import { type SqlDatabase } from './database';

export type PlaceKind = 'recent' | 'home' | 'work';
export type SavedKind = Exclude<PlaceKind, 'recent'>;

/** A stored place (technical design § Data model). */
export interface Place {
  id: string;
  name: string;
  address: string;
  /** Places ID; null for a place without one. */
  placeId: string | null;
  lat: number;
  lng: number;
  kind: PlaceKind;
  lastUsedAt: number;
}

/** What callers pass in; the repository assigns id, kind and lastUsedAt. */
export type PlaceInput = Pick<Place, 'name' | 'address' | 'placeId' | 'lat' | 'lng'>;

/** Recents kept on the device (FR-6). Saved Home and Work don't count. */
export const MAX_RECENTS = 10;

export interface PlacesRepo {
  /** Most recent first. */
  listRecents(): Promise<Place[]>;
  /** Upserts by placeId, bumps lastUsedAt, trims to MAX_RECENTS. */
  addRecent(place: PlaceInput): Promise<Place>;
  /** Deletes recents only; Home and Work stay. */
  clearRecents(): Promise<void>;
  getSaved(kind: SavedKind): Promise<Place | null>;
  setSaved(kind: SavedKind, place: PlaceInput): Promise<Place>;
  removeSaved(kind: SavedKind): Promise<void>;
}

interface PlaceRow {
  id: string;
  kind: PlaceKind;
  name: string;
  address: string;
  place_id: string | null;
  lat: number;
  lng: number;
  last_used_at: number;
}

const fromRow = (row: PlaceRow): Place => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  address: row.address,
  placeId: row.place_id,
  lat: row.lat,
  lng: row.lng,
  lastUsedAt: row.last_used_at,
});

/** A recent's identity: its place ID, or its coordinates when it has none. */
const recentId = (place: PlaceInput): string =>
  `recent:${place.placeId ?? `${place.lat.toFixed(5)},${place.lng.toFixed(5)}`}`;

const UPSERT = `
  INSERT INTO places (id, kind, name, address, place_id, lat, lng, last_used_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name, address = excluded.address, place_id = excluded.place_id,
    lat = excluded.lat, lng = excluded.lng, last_used_at = excluded.last_used_at`;

export function createPlacesRepo(db: SqlDatabase, now: () => number = Date.now): PlacesRepo {
  async function upsert(id: string, kind: PlaceKind, place: PlaceInput): Promise<Place> {
    const stored: Place = { ...place, id, kind, lastUsedAt: now() };
    await db.run(UPSERT, [
      id,
      kind,
      place.name,
      place.address,
      place.placeId,
      place.lat,
      place.lng,
      stored.lastUsedAt,
    ]);
    return stored;
  }

  return {
    async listRecents() {
      const rows = await db.getAll<PlaceRow>(
        `SELECT * FROM places WHERE kind = 'recent' ORDER BY last_used_at DESC, rowid DESC LIMIT ?`,
        [MAX_RECENTS],
      );
      return rows.map(fromRow);
    },

    async addRecent(place) {
      let stored: Place | undefined;
      await db.transaction(async () => {
        stored = await upsert(recentId(place), 'recent', place);
        await db.run(
          `DELETE FROM places WHERE kind = 'recent' AND id NOT IN (
             SELECT id FROM places WHERE kind = 'recent'
             ORDER BY last_used_at DESC, rowid DESC LIMIT ?)`,
          [MAX_RECENTS],
        );
      });
      return stored!;
    },

    async clearRecents() {
      await db.run(`DELETE FROM places WHERE kind = 'recent'`);
    },

    async getSaved(kind) {
      const row = await db.getFirst<PlaceRow>('SELECT * FROM places WHERE id = ?', [kind]);
      return row ? fromRow(row) : null;
    },

    // Home and Work use their kind as the row id, so there is at most one of each.
    setSaved: (kind, place) => upsert(kind, kind, place),

    async removeSaved(kind) {
      await db.run('DELETE FROM places WHERE id = ?', [kind]);
    },
  };
}
