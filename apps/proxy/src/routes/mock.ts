import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { type RouteSource, type RoutesRequest, type RoutesResponse } from '@routes/api-types';
import { type RoutesProvider } from '../providers';
import { type CallResult, ROUTE_SOURCES, mergeCalls } from './merge';

/** `fixtures/` at the repo root; the same relative path from `src/` and `dist/`. */
export const DEFAULT_FIXTURES_DIR = resolve(__dirname, '..', '..', '..', '..', 'fixtures');

const RoutesIndexSchema = z.object({
  routes: z.object({
    default: z.string(),
    byPlaceId: z.record(
      z.string(),
      z.object({
        tolls: z.string().optional(),
        avoidTolls: z.string().optional(),
        behaviour: z.enum(['empty', 'error500', 'partialError', 'delayMs']).optional(),
        delayMs: z.number().int().nonnegative().optional(),
      }),
    ),
  }),
});
type RoutesIndex = z.infer<typeof RoutesIndexSchema>;

export interface MockRoutesOptions {
  fixturesDir?: string;
  /** Injected so tests need not wait for `delayMs` fixtures. */
  sleep?: (ms: number) => Promise<void>;
}

export const realSleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/**
 * Serves raw Google responses from `fixtures/` by destination place ID and
 * runs them through the same normalization and merge as the Google provider.
 * An unknown or missing place ID gets the default (canonical) fixture.
 */
export class MockRoutesProvider implements RoutesProvider {
  private readonly dir: string;
  private readonly sleep: (ms: number) => Promise<void>;
  private index: Promise<RoutesIndex> | undefined;

  constructor(options: MockRoutesOptions = {}) {
    this.dir = options.fixturesDir ?? DEFAULT_FIXTURES_DIR;
    this.sleep = options.sleep ?? realSleep;
  }

  async computeRoutes(request: RoutesRequest): Promise<RoutesResponse> {
    const index = await (this.index ??= this.readJson('index.json').then((json) =>
      RoutesIndexSchema.parse(json),
    ));
    const placeId = request.destination.placeId;
    const entry =
      (placeId !== undefined ? index.routes.byPlaceId[placeId] : undefined) ??
      index.routes.byPlaceId[index.routes.default]!;
    if (entry.delayMs) await this.sleep(entry.delayMs);

    const results = {} as Record<RouteSource, CallResult>;
    for (const source of ROUTE_SOURCES) {
      const file = entry[source];
      // A call with no fixture file stands for an HTTP 500 from Google.
      results[source] = file
        ? { ok: true, body: await this.readJson(file) }
        : { ok: false, reason: 'error' };
    }
    return mergeCalls(results);
  }

  private async readJson(file: string): Promise<unknown> {
    return JSON.parse(await readFile(join(this.dir, file), 'utf8'));
  }
}
