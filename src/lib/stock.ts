import { BusinessError } from "./domain";
type Lot = {
  id: string;
  quantity: number;
  unitCostCents: number;
  expiresAt: Date | null;
  receivedAt: Date;
};
export function allocateStock(lots: Lot[], quantity: number, cutoff: Date) {
  let remaining = quantity;
  const allocations: { batchId: string; quantity: number; costCents: number }[] = [];
  const eligible = lots
    .filter((l) => l.quantity > 0 && (!l.expiresAt || l.expiresAt >= cutoff))
    .sort(
      (a, b) =>
        (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity) ||
        a.receivedAt.getTime() - b.receivedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  for (const lot of eligible) {
    const take = Math.min(lot.quantity, remaining);
    if (take > 0)
      allocations.push({ batchId: lot.id, quantity: take, costCents: take * lot.unitCostCents });
    remaining -= take;
    if (remaining === 0) break;
  }
  if (remaining > 0)
    throw new BusinessError(
      "Estoque disponível insuficiente. Lotes vencidos não podem ser vendidos.",
    );
  return allocations;
}
