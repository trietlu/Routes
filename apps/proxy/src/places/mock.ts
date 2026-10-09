import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  type AutocompleteQuery,
  type AutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsQuery,
} from '@routes/api-types';
import { ProxyError } from '../errors';
import { type PlacesProvider } from '../providers';
import { DEFAULT_FIXTURES_DIR } from '../routes/mock';
import { normalizeAutocomplete, normalizeDetails } from './normalize';

const PlacesIndexSchema = z.object({
  autocomplete: z.object({
    entries: z.array(z.object({ prefix: z.string(), file: z.string() })),
  }),
  details: z.record(z.string(), z.string()),
});
type PlacesIndex = z.infer<typeof PlacesIndexSchema>;

/**
 * Serves raw Places responses from `fixtures/places/` through the same
 * normalization as the Google provider. A query matches the first entry whose
 * prefix it starts with (trimmed, lower-cased); no match means no suggestions.
 */
export class MockPlacesProvider implements PlacesProvider {
  private index: Promise<PlacesIndex> | undefined;

  constructor(private readonly dir: string = DEFAULT_FIXTURES_DIR) {}

  async autocomplete(query: AutocompleteQuery): Promise<AutocompleteResponse> {
    const { autocomplete } = await this.loadIndex();
    const text = query.q.trim().toLowerCase();
    const entry = autocomplete.entries.find((candidate) => text.startsWith(candidate.prefix));
    const body = entry ? await this.readJson(entry.file) : {};
    return normalizeAutocomplete(body, query.lat !== undefined);
  }

  async details(query: PlaceDetailsQuery): Promise<PlaceDetails> {
    const { details } = await this.loadIndex();
    const file = details[query.placeId];
    // Google rejects an unknown place ID; the mock reports it the same way.
    if (!file) throw new ProxyError('UPSTREAM_ERROR', 'The places provider returned an error');
    return normalizeDetails(await this.readJson(file));
  }

  private loadIndex(): Promise<PlacesIndex> {
    return (this.index ??= this.readJson('index.json').then((json) =>
      PlacesIndexSchema.parse(json),
    ));
  }

  private async readJson(file: string): Promise<unknown> {
    return JSON.parse(await readFile(join(this.dir, file), 'utf8'));
  }
}
