import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type ProviderRoute } from '@routes/api-types';
// The proxy's own normalizer, so app tests see exactly what the proxy returns in mock mode.
import { normalizeComputeRoutes } from '../../proxy/src/routes/normalize';

const FIXTURES = join(__dirname, '..', '..', '..', 'fixtures', 'routes');

/** `POST /routes` for a fixture place, as the mock proxy merges it (tolls, then avoidTolls). */
export function fixtureRoutes(placeId: string): ProviderRoute[] {
  return (['tolls', 'avoidTolls'] as const).flatMap((source) => {
    const body: unknown = JSON.parse(
      readFileSync(join(FIXTURES, `${placeId}.${source}.json`), 'utf8'),
    );
    return normalizeComputeRoutes(body, source);
  });
}
