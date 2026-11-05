/**
 * Normalises a business/brand name for lookup: lower-case, any run of
 * non-alphanumeric characters collapsed to one space, trimmed.
 * "Victory Skating", "victory-skating" and "  VICTORY  skating " all map to
 * "victory skating". Stored keys are written with this same function.
 */
export function toLookupKey(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
