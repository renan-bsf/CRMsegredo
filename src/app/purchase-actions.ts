"use server";
import { z } from "zod";
import { requireActor } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { mutation, transaction } from "@/lib/server/mutate";
import { registerPurchase, receivePurchase, cancelPurchase } from "@/lib/server/purchasing";
import { purchaseSchema } from "@/lib/purchasing";

export async function savePurchase(input: unknown) {
  const actor = await requireActor("manage");
  let documentId: string | undefined;
  const result = await mutation(
    actor,
    async () => {
      const data = purchaseSchema.parse(input);
      documentId = await transaction((tx) => registerPurchase(tx, actor, data));
    },
    "Documento registrado.",
  );
  return { ...result, documentId };
}
export async function receiveInvoice(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const id = z.string().uuid().parse(input);
      await transaction((tx) => receivePurchase(tx, actor, id));
    },
    "Recebimento confirmado e estoque atualizado.",
  );
}
export async function cancelPurchaseDocument(input: unknown) {
  const actor = await requireActor("manage");
  return mutation(
    actor,
    async () => {
      const data = z
        .object({
          id: z.string().uuid(),
          reason: z
            .string()
            .trim()
            .min(8, "Explique o motivo com pelo menos 8 caracteres.")
            .max(300),
        })
        .parse(input);
      await transaction((tx) => cancelPurchase(tx, actor, data.id, data.reason));
    },
    "Registro cancelado.",
  );
}
export async function findPurchaseProducts(input: unknown) {
  const actor = await requireActor("manage");
  const q = z.string().trim().min(2).max(100).parse(input);
  if (actor.demo) return [];
  const rows = await db().variant.findMany({
    where: {
      active: true,
      product: { active: true },
      OR: [
        { sku: { contains: q, mode: "insensitive" } },
        { product: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      sku: true,
      color: true,
      size: true,
      product: { select: { name: true, type: true } },
    },
    take: 20,
    orderBy: { sku: "asc" },
  });
  return rows.map((v) => ({
    id: v.id,
    label: v.product.name + " · " + v.sku + " · " + v.color + " · " + v.size,
    cosmetic: v.product.type === "COSMETIC",
  }));
}
