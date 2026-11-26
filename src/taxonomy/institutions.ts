import { Account, InstitutionInfo } from '../types';

/**
 * Combines Plutus institutions and existing portfolio account institutions into a
 * trimmed, case-insensitively deduplicated list of non-empty institution names.
 */
export function buildInstitutionOptions(
  institutions: readonly InstitutionInfo[],
  accounts: readonly Account[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const appendName = (raw: string | null | undefined) => {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    result.push(trimmed);
  };

  for (const inst of institutions) appendName(inst.name);
  for (const acc of accounts) appendName(acc.institution);

  return result;
}
