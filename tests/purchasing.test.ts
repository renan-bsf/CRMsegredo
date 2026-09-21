import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { purchaseSchema, purchaseTotal } from "@/lib/purchasing";
import type { Actor } from "@/lib/domain";
vi.mock("@/lib/server/mutate", () => ({ audit: vi.fn() }));
import { receivePurchase, cancelPurchase, registerPurchase } from "@/lib/server/purchasing";
const actor: Actor = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test",
  role: "ADMIN",
  demo: false,
};
const item = {
  variantId: actor.id,
  quantity: 2,
  unitCostCents: 1234,
  lotCode: "L1",
  expiresAt: "",
};
const input = {
  idempotencyKey: actor.id,
  kind: "INVOICE",
  supplierName: "Fornecedor",
  supplierTaxId: "12.345.678/0001-90",
  number: "10",
  series: "1",
  issuedAt: "2026-09-21",
  items: [item],
};
describe("validação de documentos", () => {
  it("normaliza o CNPJ e calcula total em centavos", () => {
    expect(purchaseSchema.parse(input).supplierTaxId).toBe("12345678000190");
    expect(purchaseTotal([item])).toBe(2468);
  });
  it("rejeita documentos sem itens, chave incompleta e itens duplicados", () => {
    expect(purchaseSchema.safeParse({ ...input, items: [] }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...input, accessKey: "123" }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...input, items: [item, item] }).success).toBe(false);
  });
  it("recusa notas sem lote e pedidos com chave fiscal", () => {
    expect(purchaseSchema.safeParse({ ...input, items: [{ ...item, lotCode: "" }] }).success).toBe(
      false,
    );
    expect(
      purchaseSchema.safeParse({ ...input, kind: "ORDER", accessKey: "1".repeat(44) }).success,
    ).toBe(false);
  });
  it("recusa custos fracionários, quantidades negativas, datas inválidas e totais excedidos", () => {
    expect(
      purchaseSchema.safeParse({ ...input, items: [{ ...item, unitCostCents: 1.1 }] }).success,
    ).toBe(false);
    expect(purchaseSchema.safeParse({ ...input, items: [{ ...item, quantity: -1 }] }).success).toBe(
      false,
    );
    expect(purchaseSchema.safeParse({ ...input, issuedAt: "2026-02-30" }).success).toBe(false);
    expect(() => purchaseTotal([{ quantity: 10000, unitCostCents: 100000000 }])).toThrow();
  });
});
const tx = {
  purchaseDocument: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  purchaseItem: { update: vi.fn() },
  batch: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  stockMovement: { create: vi.fn() },
  variant: { findMany: vi.fn() },
};
const db = tx as unknown as Prisma.TransactionClient;
const doc = () => ({
  id: actor.id,
  kind: "INVOICE",
  status: "REGISTERED",
  number: "10",
  series: "1",
  supplierName: "Test",
  items: [
    {
      ...item,
      id: "item-1",
      expiresAt: null as Date | null,
      variant: { active: true, product: { active: true, type: "SET" } },
    },
  ],
});
beforeEach(() => {
  vi.resetAllMocks();
  tx.purchaseDocument.findUnique.mockResolvedValue(doc());
  tx.purchaseDocument.updateMany.mockResolvedValue({ count: 1 });
  tx.purchaseDocument.count.mockResolvedValue(0);
  tx.batch.findUnique.mockResolvedValue(null);
  tx.batch.create.mockResolvedValue({ id: "batch-1" });
});
describe("recebimento seguro", () => {
  it("registra estoque, movimento e vínculo do item uma única vez", async () => {
    await receivePurchase(db, actor, actor.id);
    expect(tx.batch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 2, unitCostCents: 1234 }),
      }),
    );
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.purchaseItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { batchId: "batch-1" },
    });
    tx.purchaseDocument.findUnique.mockResolvedValue({ ...doc(), status: "RECEIVED" });
    await receivePurchase(db, actor, actor.id);
    expect(tx.batch.create).toHaveBeenCalledTimes(1);
  });
  it("não recebe duas vezes quando perde a disputa pela nota", async () => {
    tx.purchaseDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(receivePurchase(db, actor, actor.id)).rejects.toThrow("já foi processada");
    expect(tx.batch.create).not.toHaveBeenCalled();
  });
  it("bloqueia pedidos, notas canceladas e lotes vencidos", async () => {
    tx.purchaseDocument.findUnique.mockResolvedValue({ ...doc(), kind: "ORDER" });
    await expect(receivePurchase(db, actor, actor.id)).rejects.toThrow("Somente notas");
    tx.purchaseDocument.findUnique.mockResolvedValue({ ...doc(), status: "CANCELLED" });
    await expect(receivePurchase(db, actor, actor.id)).rejects.toThrow("cancelada");
    const expired = doc();
    expired.items[0]!.expiresAt = new Date("2000-01-01");
    tx.purchaseDocument.findUnique.mockResolvedValue(expired);
    await expect(receivePurchase(db, actor, actor.id)).rejects.toThrow("vencido");
    expect(tx.batch.create).not.toHaveBeenCalled();
  });
  it("bloqueia conflito de custo no lote existente", async () => {
    tx.batch.findUnique.mockResolvedValue({ id: "batch-1", unitCostCents: 1000, expiresAt: null });
    await expect(receivePurchase(db, actor, actor.id)).rejects.toThrow("outro custo");
  });
  it("adiciona quantidade ao lote existente com mesmo custo e validade", async () => {
    tx.batch.findUnique.mockResolvedValue({ id: "batch-1", unitCostCents: 1234, expiresAt: null });
    tx.batch.update.mockResolvedValue({ id: "batch-1" });
    await receivePurchase(db, actor, actor.id);
    expect(tx.batch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: { quantity: { increment: 2 } },
    });
  });
  it("recusa cancelar documento recebido e pedido com notas ativas", async () => {
    tx.purchaseDocument.updateMany.mockResolvedValue({ count: 0 });
    await expect(cancelPurchase(db, actor, actor.id, "Teste de motivo")).rejects.toThrow(
      "não recebidos",
    );
    tx.purchaseDocument.count.mockResolvedValue(1);
    await expect(cancelPurchase(db, actor, actor.id, "Teste de motivo")).rejects.toThrow(
      "notas ativas",
    );
  });
  it("cadastro não movimenta estoque e calcula o total no servidor", async () => {
    tx.purchaseDocument.findUnique.mockResolvedValue(null);
    tx.variant.findMany.mockResolvedValue([
      {
        id: actor.id,
        sku: "SKU",
        color: "Preto",
        size: "M",
        product: { name: "Produto", type: "SET" },
      },
    ]);
    tx.purchaseDocument.create.mockResolvedValue({ id: actor.id });
    await registerPurchase(db, actor, purchaseSchema.parse(input));
    expect(tx.purchaseDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalCents: 2468 }) }),
    );
    expect(tx.batch.create).not.toHaveBeenCalled();
  });
});

describe("cadastro de compras", () => {
  it("reutiliza a resposta de um envio já registrado sem gravar novamente", async () => {
    const result = await registerPurchase(db, actor, purchaseSchema.parse(input));
    expect(result).toBe(actor.id);
    expect(tx.purchaseDocument.create).not.toHaveBeenCalled();
    expect(tx.variant.findMany).not.toHaveBeenCalled();
  });
  it("recusa vincular nota a pedido cancelado ou de outro fornecedor", async () => {
    for (const order of [
      { kind: "ORDER", status: "CANCELLED", supplierTaxId: "12345678000190" },
      { kind: "ORDER", status: "REGISTERED", supplierTaxId: "99999999000199" },
      { kind: "INVOICE", status: "REGISTERED", supplierTaxId: "12345678000190" },
    ]) {
      tx.purchaseDocument.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(order);
      await expect(
        registerPurchase(db, actor, purchaseSchema.parse({ ...input, sourceOrderId: actor.id })),
      ).rejects.toThrow("pedido ativo do mesmo fornecedor");
    }
    expect(tx.purchaseDocument.create).not.toHaveBeenCalled();
  });
  it("não cadastra variante indisponível ou cosmético sem validade", async () => {
    tx.purchaseDocument.findUnique.mockResolvedValue(null);
    tx.variant.findMany.mockResolvedValue([]);
    await expect(registerPurchase(db, actor, purchaseSchema.parse(input))).rejects.toThrow(
      "não está mais disponível",
    );
    tx.variant.findMany.mockResolvedValue([
      {
        id: actor.id,
        sku: "SKU",
        color: "",
        size: "",
        product: { name: "Cosmético", type: "COSMETIC" },
      },
    ]);
    await expect(registerPurchase(db, actor, purchaseSchema.parse(input))).rejects.toThrow(
      "exigem a validade",
    );
    expect(tx.purchaseDocument.create).not.toHaveBeenCalled();
  });
});
