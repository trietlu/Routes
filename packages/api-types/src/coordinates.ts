import { z } from 'zod';

/** Latitude in degrees, WGS 84. */
export const LatitudeSchema = z.number().finite().min(-90).max(90);

/** Longitude in degrees, WGS 84. */
export const LongitudeSchema = z.number().finite().min(-180).max(180);

/**
 * Query-string values always arrive as strings. Turn a non-blank string into a
 * number before validating; anything else is passed through so the number
 * schema rejects it (an empty string must not become 0).
 */
export function fromQueryNumber<T extends z.ZodNumber>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
    schema,
  );
}
