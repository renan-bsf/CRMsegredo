import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireActor } from "./auth";
import { db } from "./db";
export async function getPurchases(q = "", kind = "", status = "", page = 1) {
  const actor = await requireActor("manage");
  if (actor.demo) return { rows: [], total: 0 };
  const where: Prisma.PurchaseDocumentWhereInput = {
    ...(["ORDER", "INVOICE"].includes(kind) ? { kind: kind as "ORDER" | "INVOICE" } : {}),
    ...(["REGISTERED", "RECEIVED", "CANCELLED"].includes(status)
      ? { status: status as "REGISTERED" | "RECEIVED" | "CANCELLED" }
      : {}),
    ...(q
      ? {
          OR: [
            { supplierName: { contains: q, mode: "insensitive" } },
            { supplierTaxId: { contains: q } },
            { number: { contains: q, mode: "insensitive" } },
            { accessKey: { contains: q } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db().purchaseDocument.findMany({
      where,
      select: {
        id: true,
        kind: true,
        status: true,
        number: true,
        series: true,
        supplierName: true,
        issuedAt: true,
        totalCents: true,
        _count: { select: { items: true } },
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      take: 50,
      skip: (page - 1) * 50,
    }),
    db().purchaseDocument.count({ where }),
  ]);
  return { rows, total };
}
export async function getPurchase(id: string) {
  const actor = await requireActor("manage");
  if (actor.demo || !z.string().uuid().safeParse(id).success) return null;
  return db().purchaseDocument.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: { variant: { select: { product: { select: { type: true } } } } },
      },
      sourceOrder: { select: { id: true, number: true } },
      invoices: {
        select: { id: true, number: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
