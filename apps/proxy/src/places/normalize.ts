import { z } from 'zod';
import {
  type AutocompleteResponse,
  AutocompleteResponseSchema,
  type PlaceDetails,
  PlaceDetailsSchema,
} from '@routes/api-types';

const TextSchema = z.object({ text: z.string() });

/** The parts of a Places API (New) autocomplete body the proxy reads. */
const GoogleAutocompleteSchema = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({
            placeId: z.string().min(1),
            text: TextSchema.optional(),
            structuredFormat: z
              .object({ mainText: TextSchema.optional(), secondaryText: TextSchema.optional() })
              .optional(),
            distanceMeters: z.number().nonnegative().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/** The fields of a place details body the proxy asks for. */
const GoogleDetailsSchema = z.object({
  id: z.string().min(1),
  displayName: TextSchema.optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
});

/**
 * Place predictions only (query predictions are skipped). Google returns `{}`
 * when nothing matches. `distanceMeters` is dropped when no start was given,
 * since it is then meaningless.
 */
export function normalizeAutocomplete(body: unknown, hasOrigin: boolean): AutocompleteResponse {
  const parsed = GoogleAutocompleteSchema.parse(body);
  const suggestions = (parsed.suggestions ?? []).flatMap(({ placePrediction: p }) => {
    if (!p) return [];
    return [
      {
        placeId: p.placeId,
        primaryText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        ...(hasOrigin && p.distanceMeters !== undefined
          ? { distanceMeters: p.distanceMeters }
          : {}),
      },
    ];
  });
  return AutocompleteResponseSchema.parse({ suggestions });
}

export function normalizeDetails(body: unknown): PlaceDetails {
  const parsed = GoogleDetailsSchema.parse(body);
  return PlaceDetailsSchema.parse({
    placeId: parsed.id,
    name: parsed.displayName?.text ?? '',
    address: parsed.formattedAddress ?? '',
    lat: parsed.location.latitude,
    lng: parsed.location.longitude,
  });
}
