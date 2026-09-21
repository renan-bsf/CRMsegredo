"use server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  customerSchema,
  productSchema,
  receiptSchema,
  saleSchema,
  expenseSchema,
  adjustmentSchema,
  BusinessError,
  saleTotal,
  expiryCutoff,
} from "@/lib/domain";
import { allocateStock } from "@/lib/stock";
import { requireActor } from "@/lib/server/auth";
import { audit, mutation, transaction } from "@/lib/server/mutate";
import { encrypt, decrypt } from "@/lib/server/crypto";
import { demoCustomers } from "@/lib/server/demo";
import type { ActionResult } from "@/lib/domain";

export async function saveCustomer(input: unknown) {
  const actor = await requireActor();
  return mutation(
    actor,
    async () => {
      const data = customerSchema.parse(input);
      const id = data.id ?? randomUUID();
      const profileEncrypted = encrypt(
        JSON.stringify({
          phone: data.phone,
          braSize: data.braSize,
          bottomSize: data.bottomSize,
          notes: data.notes,
        }),
        id,
      );
      await transaction(async (tx) => {
        const fields = {
          name: data.name,
          profileEncrypted,
          consentAt: data.consent ? new Date() : null,
        };
        if (data.id) await tx.customer.update({ where: { id }, data: fields });
        else await tx.customer.create({ data: { id, ...fields } });
        await audit(tx, actor, data.id ? "CUSTOMER_UPDATED" : "CUSTOMER_CREATED", id);
      });
    },
    "Cliente salvo com sucesso.",
  );
}

export async function saveProduct(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = productSchema.parse(input);
      await transaction(async (tx) => {
        const product = data.productId
          ? await tx.product.findUnique({ where: { id: data.productId, active: true } })
          : await tx.product.create({
              data: { name: data.name, category: data.category, type: data.type },
            });
        if (!product) throw new BusinessError("Produto não encontrado.");
        if (product.type === "ELECTRONIC" && !data.power)
          throw new BusinessError("Informe a alimentação do eletrônico.");
        const variant = await tx.variant.create({
          data: {
            productId: product.id,
            sku: data.sku.toUpperCase(),
            color: data.color,
            size: data.size,
            braBand: data.braBand,
            braCup: data.braCup || null,
            bottomSize: data.bottomSize || null,
            power: data.power || null,
            priceCents: data.priceCents,
            minStock: data.minStock,
          },
        });
        await audit(tx, actor, "VARIANT_CREATED", variant.id);
      });
    },
    "Produto e variação cadastrados.",
  );
}

export async function receiveStock(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = receiptSchema.parse(input);
      await transaction(async (tx) => {
        const variant = await tx.variant.findUnique({
          where: { id: data.variantId, active: true },
          include: { product: true },
        });
        if (!variant || !variant.product.active) throw new BusinessError("Variação indisponível.");
        if (variant.product.type === "COSMETIC" && !data.expiresAt)
          throw new BusinessError("Cosméticos exigem lote e validade.");
        const expiresAt = data.expiresAt ? new Date(`${data.expiresAt}T00:00:00Z`) : null;
        if (expiresAt && expiresAt < expiryCutoff())
          throw new BusinessError("A validade não pode estar vencida.");
        const batch = await tx.batch.create({
          data: {
            variantId: data.variantId,
            code: data.code,
            quantity: data.quantity,
            unitCostCents: data.unitCostCents,
            expiresAt,
          },
        });
        await tx.stockMovement.create({
          data: {
            batchId: batch.id,
            memberId: actor.id,
            type: "RECEIPT",
            delta: data.quantity,
            reason: "Recebimento de mercadoria",
          },
        });
        await audit(tx, actor, "STOCK_RECEIVED", batch.id);
      });
    },
    "Entrada de estoque registrada.",
  );
}

export async function adjustStock(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = adjustmentSchema.parse(input);
      await transaction(async (tx) => {
        const changed = await tx.batch.updateMany({
          where: {
            id: data.batchId,
            ...(data.delta < 0 ? { quantity: { gte: -data.delta } } : {}),
          },
          data: { quantity: { increment: data.delta } },
        });
        if (!changed.count) throw new BusinessError("Lote inválido ou saldo insuficiente.");
        await tx.stockMovement.create({
          data: { ...data, memberId: actor.id, type: "ADJUSTMENT" },
        });
        await audit(tx, actor, "STOCK_ADJUSTED", data.batchId);
      });
    },
    "Ajuste registrado na movimentação.",
  );
}

export async function createSale(input: unknown) {
  const actor = await requireActor();
  return mutation(
    actor,
    async () => {
      const data = saleSchema.parse(input);
      const requestHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
      await transaction(async (tx) => {
        const previous = await tx.sale.findUnique({
          where: { idempotencyKey: data.idempotencyKey },
        });
        if (previous) {
          if (previous.memberId !== actor.id || previous.requestHash !== requestHash)
            throw new BusinessError("Identificador de venda já utilizado. Abra uma nova venda.");
          return;
        }
        if (
          data.customerId &&
          !(await tx.customer.findUnique({ where: { id: data.customerId, active: true } }))
        )
          throw new BusinessError("Cliente indisponível.");
        if (data.paymentStatus === "PENDING" && !data.customerId)
          throw new BusinessError("Selecione um cliente para uma venda a receber.");
        const lines = [];
        for (const item of [...data.items].sort((a, b) => a.variantId.localeCompare(b.variantId))) {
          const variant = await tx.variant.findUnique({
            where: { id: item.variantId, active: true },
            include: { product: true, batches: true },
          });
          if (!variant || !variant.product.active)
            throw new BusinessError("Um dos produtos está indisponível.");
          const allocations = allocateStock(variant.batches, item.quantity, expiryCutoff());
          for (const allocation of allocations) {
            const changed = await tx.batch.updateMany({
              where: { id: allocation.batchId, quantity: { gte: allocation.quantity } },
              data: { quantity: { decrement: allocation.quantity } },
            });
            if (changed.count !== 1)
              throw new BusinessError("O estoque mudou. Atualize e tente novamente.");
            await tx.stockMovement.create({
              data: {
                batchId: allocation.batchId,
                memberId: actor.id,
                type: "SALE",
                delta: -allocation.quantity,
                reason: "Venda direta",
              },
            });
          }
          lines.push({
            variantId: variant.id,
            description: `${variant.product.name} · ${variant.size} · ${variant.color}`,
            quantity: item.quantity,
            unitPriceCents: variant.priceCents,
            costCents: allocations.reduce((s, a) => s + a.costCents, 0),
            allocations,
          });
        }
        const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
        const totalCents = saleTotal(subtotalCents, data.discountCents);
        const costCents = lines.reduce((sum, l) => sum + l.costCents, 0);
        if (costCents > 2_000_000_000)
          throw new BusinessError("Custo total acima do limite permitido.");
        const sale = await tx.sale.create({
          data: {
            idempotencyKey: data.idempotencyKey,
            requestHash,
            memberId: actor.id,
            customerId: data.customerId,
            paymentMethod: data.paymentMethod,
            paymentStatus: data.paymentStatus,
            paidAt: data.paymentStatus === "PAID" ? new Date() : null,
            subtotalCents,
            discountCents: data.discountCents,
            totalCents,
            costCents,
            items: {
              create: lines.map((line) => ({
                ...line,
                allocations: {
                  create: line.allocations.map((a) => ({
                    batchId: a.batchId,
                    quantity: a.quantity,
                  })),
                },
              })),
            },
          },
        });
        await audit(tx, actor, "SALE_CREATED", sale.id);
      });
    },
    "Venda registrada e estoque atualizado.",
  );
}

export async function cancelSale(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const id = z.string().uuid().parse(input);
      await transaction(async (tx) => {
        const sale = await tx.sale.findUnique({
          where: { id },
          include: { items: { include: { allocations: true } } },
        });
        if (!sale) throw new BusinessError("Venda não encontrada.");
        if (sale.status === "CANCELLED") return;
        await tx.sale.update({
          where: { id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        for (const item of sale.items)
          for (const allocation of item.allocations) {
            await tx.batch.update({
              where: { id: allocation.batchId },
              data: { quantity: { increment: allocation.quantity } },
            });
            await tx.stockMovement.create({
              data: {
                batchId: allocation.batchId,
                memberId: actor.id,
                type: "REVERSAL",
                delta: allocation.quantity,
                reason: `Cancelamento da venda ${sale.number}`,
              },
            });
          }
        await audit(tx, actor, "SALE_CANCELLED", id);
      });
    },
    "Venda cancelada e estoque devolvido. Confira a devolução do pagamento fora do sistema.",
  );
}
export async function markSalePaid(input: unknown) {
  const actor = await requireActor();
  return mutation(
    actor,
    async () => {
      const id = z.string().uuid().parse(input);
      await transaction(async (tx) => {
        const result = await tx.sale.updateMany({
          where: { id, status: "COMPLETED", paymentStatus: "PENDING" },
          data: { paymentStatus: "PAID", paidAt: new Date() },
        });
        if (!result.count)
          throw new BusinessError("Venda já recebida, cancelada ou não encontrada.");
        await audit(tx, actor, "SALE_PAID", id);
      });
    },
    "Recebimento confirmado.",
  );
}
export async function saveExpense(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = expenseSchema.parse(input);
      await transaction(async (tx) => {
        const expense = await tx.expense.create({
          data: {
            ...data,
            occurredAt: new Date(data.occurredAt + "T00:00:00Z"),
            memberId: actor.id,
          },
        });
        await audit(tx, actor, "EXPENSE_CREATED", expense.id);
      });
    },
    "Lançamento financeiro registrado.",
  );
}
export async function voidExpense(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const id = z.string().uuid().parse(input);
      await transaction(async (tx) => {
        const result = await tx.expense.updateMany({
          where: { id, voidedAt: null },
          data: { voidedAt: new Date() },
        });
        if (!result.count) throw new BusinessError("Lançamento indisponível.");
        await audit(tx, actor, "EXPENSE_VOIDED", id);
      });
    },
    "Lançamento anulado; histórico preservado.",
  );
}
export async function archiveCustomer(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const id = z.string().uuid().parse(input);
      await transaction(async (tx) => {
        await tx.customer.update({ where: { id }, data: { active: false } });
        await audit(tx, actor, "CUSTOMER_ARCHIVED", id);
      });
    },
    "Cliente arquivado.",
  );
}

export async function readCustomer(
  input: unknown,
): Promise<{ data?: z.infer<typeof customerSchema>; error?: string }> {
  const actor = await requireActor();
  const parsed = z.string().uuid().safeParse(input);
  if (!parsed.success) return { error: "Cliente inválido." };
  if (actor.demo) {
    const customer = demoCustomers.find((c) => c.id === parsed.data);
    return customer
      ? {
          data: {
            id: customer.id,
            name: customer.name,
            phone: "",
            braSize: customer.consent ? "40B" : "",
            bottomSize: customer.consent ? "M" : "",
            notes: customer.consent ? "Perfil fictício para demonstração." : "",
            consent: customer.consent,
          },
        }
      : { error: "Cliente não encontrado." };
  }
  try {
    const data = await transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: parsed.data, active: true } });
      if (!customer) throw new BusinessError("Cliente não encontrado.");
      const profile: unknown = JSON.parse(decrypt(customer.profileEncrypted, customer.id));
      const fields = z
        .object({
          phone: z.string(),
          braSize: z.string(),
          bottomSize: z.string(),
          notes: z.string(),
        })
        .parse(profile);
      await audit(tx, actor, "CUSTOMER_PROFILE_VIEWED", customer.id);
      return customerSchema.parse({
        id: customer.id,
        name: customer.name,
        ...fields,
        consent: Boolean(customer.consentAt),
      });
    });
    return { data };
  } catch {
    return { error: "Não foi possível abrir o perfil. Tente novamente." };
  }
}

export async function updateVariant(input: unknown): Promise<ActionResult> {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = z
        .object({
          id: z.string().uuid(),
          priceCents: z.number().int().min(1).max(100_000_000),
          minStock: z.number().int().min(0).max(10000),
          active: z.boolean(),
        })
        .parse(input);
      await transaction(async (tx) => {
        await tx.variant.update({
          where: { id: data.id },
          data: { priceCents: data.priceCents, minStock: data.minStock, active: data.active },
        });
        await audit(tx, actor, "VARIANT_UPDATED", data.id);
      });
    },
    "Variação atualizada.",
  );
}

export async function updateMember(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = z
        .object({ id: z.string().uuid(), role: z.enum(["ADMIN", "OPERATOR"]), active: z.boolean() })
        .parse(input);
      if (data.id === actor.id)
        throw new BusinessError(
          "Sua própria permissão deve ser alterada pelo outro administrador.",
        );
      await transaction(async (tx) => {
        // Serializable evita que dois sócios removam o último administrador simultaneamente.
        const admins = await tx.member.count({ where: { role: "ADMIN", active: true } });
        const target = await tx.member.findUnique({ where: { id: data.id } });
        if (!target) throw new BusinessError("Usuário não encontrado.");
        if (
          target.role === "ADMIN" &&
          target.active &&
          (!data.active || data.role !== "ADMIN") &&
          admins <= 1
        )
          throw new BusinessError("Mantenha pelo menos um administrador ativo.");
        await tx.member.update({
          where: { id: data.id },
          data: { role: data.role, active: data.active },
        });
        await audit(tx, actor, "MEMBER_UPDATED", data.id);
      });
    },
    "Acesso atualizado. A alteração vale na próxima operação do usuário.",
  );
}
