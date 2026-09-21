import "server-only";
import type { Prisma } from "@prisma/client";
import { BusinessError, expiryCutoff, type Actor } from "@/lib/domain";
import { purchaseTotal, type PurchaseInput } from "@/lib/purchasing";
import { audit } from "./mutate";

export async function registerPurchase(
  tx: Prisma.TransactionClient,
  actor: Actor,
  data: PurchaseInput,
) {
  const previous = await tx.purchaseDocument.findUnique({
    where: { idempotencyKey: data.idempotencyKey },
  });
  if (previous) return previous.id;
  if (data.sourceOrderId) {
    const order = await tx.purchaseDocument.findUnique({ where: { id: data.sourceOrderId } });
    if (
      !order ||
      order.kind !== "ORDER" ||
      order.status === "CANCELLED" ||
      order.supplierTaxId !== data.supplierTaxId
    )
      throw new BusinessError("Selecione um pedido ativo do mesmo fornecedor.");
  }
  const variants = await tx.variant.findMany({
    where: {
      id: { in: data.items.map((item) => item.variantId) },
      active: true,
      product: { active: true },
    },
    include: { product: true },
  });
  const items = data.items.map((item) => {
    const variant = variants.find((v) => v.id === item.variantId);
    if (!variant) throw new BusinessError("Um produto não está mais disponível. Revise os itens.");
    if (data.kind === "INVOICE" && variant.product.type === "COSMETIC" && !item.expiresAt)
      throw new BusinessError("Cosméticos exigem a validade do lote.");
    return {
      ...item,
      expiresAt: item.expiresAt ? new Date(item.expiresAt + "T00:00:00Z") : null,
      description: (
        variant.product.name +
        " · " +
        variant.sku +
        " · " +
        variant.color +
        " · " +
        variant.size
      ).slice(0, 240),
    };
  });
  const document = await tx.purchaseDocument.create({
    data: {
      idempotencyKey: data.idempotencyKey,
      kind: data.kind,
      supplierName: data.supplierName,
      supplierTaxId: data.supplierTaxId,
      supplierKey: data.supplierTaxId,
      number: data.number,
      series: data.series,
      accessKey: data.accessKey || null,
      issuedAt: new Date(data.issuedAt + "T00:00:00Z"),
      expectedAt: data.expectedAt ? new Date(data.expectedAt + "T00:00:00Z") : null,
      sourceOrderId: data.sourceOrderId,
      notes: data.notes,
      totalCents: purchaseTotal(items),
      memberId: actor.id,
      items: { create: items },
    },
  });
  await audit(tx, actor, "PURCHASE_REGISTERED", document.id);
  return document.id;
}

export async function receivePurchase(tx: Prisma.TransactionClient, actor: Actor, id: string) {
  const doc = await tx.purchaseDocument.findUnique({
    where: { id },
    include: { items: { include: { variant: { include: { product: true } } } } },
  });
  if (!doc || doc.kind !== "INVOICE")
    throw new BusinessError("Somente notas fiscais podem dar entrada no estoque.");
  if (doc.status === "RECEIVED") return;
  if (doc.status !== "REGISTERED") throw new BusinessError("Esta nota foi cancelada.");
  const claimed = await tx.purchaseDocument.updateMany({
    where: { id, status: "REGISTERED" },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });
  if (claimed.count !== 1) throw new BusinessError("A nota já foi processada. Atualize a página.");
  for (const item of doc.items) {
    if (!item.variant.active || !item.variant.product.active)
      throw new BusinessError("Um produto está inativo.");
    if (!item.lotCode || (item.variant.product.type === "COSMETIC" && !item.expiresAt))
      throw new BusinessError("Confira o lote e a validade dos produtos.");
    if (item.expiresAt && item.expiresAt < expiryCutoff())
      throw new BusinessError("Não é possível receber um lote vencido.");
    const existing = await tx.batch.findUnique({
      where: { variantId_code: { variantId: item.variantId, code: item.lotCode } },
    });
    if (
      existing &&
      (existing.unitCostCents !== item.unitCostCents ||
        existing.expiresAt?.getTime() !== item.expiresAt?.getTime())
    )
      throw new BusinessError("O lote " + item.lotCode + " já existe com outro custo ou validade.");
    const batch = existing
      ? await tx.batch.update({
          where: { id: existing.id },
          data: { quantity: { increment: item.quantity } },
        })
      : await tx.batch.create({
          data: {
            variantId: item.variantId,
            code: item.lotCode,
            quantity: item.quantity,
            unitCostCents: item.unitCostCents,
            expiresAt: item.expiresAt,
          },
        });
    await tx.purchaseItem.update({ where: { id: item.id }, data: { batchId: batch.id } });
    await tx.stockMovement.create({
      data: {
        memberId: actor.id,
        batchId: batch.id,
        type: "RECEIPT",
        delta: item.quantity,
        reason: ("NF " + doc.number + "/" + doc.series + " · " + doc.supplierName).slice(0, 160),
      },
    });
  }
  await audit(tx, actor, "INVOICE_RECEIVED", id);
}

export async function cancelPurchase(
  tx: Prisma.TransactionClient,
  actor: Actor,
  id: string,
  reason: string,
) {
  const linked = await tx.purchaseDocument.count({
    where: { sourceOrderId: id, status: { not: "CANCELLED" } },
  });
  if (linked) throw new BusinessError("Este pedido possui notas ativas vinculadas.");
  const result = await tx.purchaseDocument.updateMany({
    where: { id, status: "REGISTERED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
  });
  if (result.count !== 1)
    throw new BusinessError("Somente registros ainda não recebidos podem ser cancelados.");
  await audit(tx, actor, "PURCHASE_CANCELLED", id);
}
