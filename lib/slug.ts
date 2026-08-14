/**
 * Slugify a string — used for school / class URLs.
 *
 * Lowercases, replaces accented chars with their ASCII equivalent, replaces
 * whitespace / punctuation with dashes, collapses consecutive dashes.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
