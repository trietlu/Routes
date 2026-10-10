/** Fuel economy: 5–150 mpg, up to 1 decimal (UX S1). */
export const MPG_RANGE = { min: 5, max: 150 } as const;
/** Fuel price: $0.50–$15.00 per gallon, up to 2 decimals (UX S1). */
export const PRICE_RANGE = { min: 0.5, max: 15 } as const;

/** The number in `text` if it has at most `decimals` places and lies in range; else null. */
function parseInRange(
  text: string,
  decimals: number,
  range: { min: number; max: number },
): number | null {
  const trimmed = text.trim();
  const pattern = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$|^\\.\\d{1,${decimals}}$`);
  if (!pattern.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= range.min && value <= range.max ? value : null;
}

export const parseMpg = (text: string): number | null => parseInRange(text, 1, MPG_RANGE);
export const parsePrice = (text: string): number | null => parseInRange(text, 2, PRICE_RANGE);
