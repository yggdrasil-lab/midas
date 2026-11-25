function tokenizeTagsCsv(
  text: string,
  transform: (cleaned: string) => string
): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of text.split(',')) {
    const stripped = part.trim().replace(/^#+/, '').trim();
    if (!stripped) continue;
    const normalized = transform(stripped);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(normalized);
    }
  }
  return tags;
}

/**
 * Parses comma-separated tags for transaction splits while preserving original
 * casing, stripping leading `#` prefixes, and deduplicating case-insensitively.
 */
export function parseTagsCsv(text: string): string[] {
  return tokenizeTagsCsv(text, (tag) => tag);
}

/**
 * Parses comma-separated target tags for categorization rules by lowercasing,
 * stripping leading `#` prefixes, collapsing whitespace to hyphens, and deduplicating.
 */
export function parseRuleTagsCsv(text: string): string[] {
  return tokenizeTagsCsv(text, (tag) => tag.toLowerCase().replace(/\s+/g, '-'));
}
