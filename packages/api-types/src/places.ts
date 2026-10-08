import { z } from 'zod';
import { LatitudeSchema, LongitudeSchema, fromQueryNumber } from './coordinates';

/** Minimum search text length before the app asks for suggestions. */
export const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;

/** Places session token, shared by autocomplete and the details call that ends it. */
const SessionSchema = z.string().min(1).max(128);

/**
 * Query of `GET /places/autocomplete`. `lat`/`lng` are the trip start, used
 * for distances and location bias; they are optional together because the
 * start may not be known yet (location denied, start not chosen).
 */
export const AutocompleteQuerySchema = z
  .strictObject({
    q: z.string().trim().min(AUTOCOMPLETE_MIN_QUERY_LENGTH).max(200),
    lat: fromQueryNumber(LatitudeSchema).optional(),
    lng: fromQueryNumber(LongitudeSchema).optional(),
    session: SessionSchema,
  })
  .refine((query) => (query.lat === undefined) === (query.lng === undefined), {
    message: 'lat and lng must be given together',
    path: ['lat'],
  });
export type AutocompleteQuery = z.infer<typeof AutocompleteQuerySchema>;

export const AutocompleteSuggestionSchema = z.object({
  placeId: z.string().min(1),
  primaryText: z.string(),
  secondaryText: z.string(),
  /** Straight-line distance from the start; absent when no start was given. */
  distanceMeters: z.number().finite().nonnegative().optional(),
});
export type AutocompleteSuggestion = z.infer<typeof AutocompleteSuggestionSchema>;

/** Response of `GET /places/autocomplete`. */
export const AutocompleteResponseSchema = z.object({
  suggestions: z.array(AutocompleteSuggestionSchema),
});
export type AutocompleteResponse = z.infer<typeof AutocompleteResponseSchema>;

/** Query of `GET /places/details`. */
export const PlaceDetailsQuerySchema = z.strictObject({
  placeId: z.string().min(1),
  session: SessionSchema,
});
export type PlaceDetailsQuery = z.infer<typeof PlaceDetailsQuerySchema>;

/** Response of `GET /places/details`. */
export const PlaceDetailsSchema = z.object({
  placeId: z.string().min(1),
  name: z.string(),
  address: z.string(),
  lat: LatitudeSchema,
  lng: LongitudeSchema,
});
export type PlaceDetails = z.infer<typeof PlaceDetailsSchema>;
