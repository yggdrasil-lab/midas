import { Transaction } from '../types';

/**
 * Collapses paired transfer legs (linked via `linked_transaction_id`) into a single
 * combined flow row when both legs are present in the same transaction list.
 * Prefers the debit/outflow leg (`amount < 0`) as the primary representative so
 * source -> destination flow and fees remain consistent.
 */
export function collapsePairedTransfers(transactions: Transaction[]): Transaction[] {
  if (transactions.length <= 1) return transactions;

  const byId = new Map<number, Transaction>();
  for (const tx of transactions) {
    byId.set(tx.id, tx);
  }

  const consumedIds = new Set<number>();
  const collapsed: Transaction[] = [];

  for (const tx of transactions) {
    if (consumedIds.has(tx.id)) continue;

    if (tx.linked_transaction_id != null) {
      const partner = byId.get(tx.linked_transaction_id);
      if (partner && partner.id !== tx.id && !consumedIds.has(partner.id)) {
        const usePartnerAsPrimary = Number(partner.amount) < 0 && Number(tx.amount) >= 0;
        const primary = usePartnerAsPrimary ? partner : tx;
        const secondary = usePartnerAsPrimary ? tx : partner;

        consumedIds.add(primary.id);
        consumedIds.add(secondary.id);

        const mergedTags = Array.from(
          new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])
        );

        collapsed.push({
          ...primary,
          linked_account_name: primary.linked_account_name ?? secondary.account_name,
          linked_amount: primary.linked_amount ?? secondary.amount,
          linked_currency: primary.linked_currency ?? secondary.currency,
          fee_amount: primary.fee_amount ?? secondary.fee_amount,
          exchange_rate: primary.exchange_rate ?? secondary.exchange_rate,
          ...(mergedTags.length > 0 ? { tags: mergedTags } : {}),
        });
        continue;
      }
    }

    consumedIds.add(tx.id);
    collapsed.push(tx);
  }

  return collapsed;
}
