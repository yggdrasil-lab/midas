/** Normalizes a taxonomy label into a lowercase kebab-case identifier for test IDs and keys. */
export function toTaxonomySlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
