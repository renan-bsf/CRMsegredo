import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireActor } from "./auth";
import { db } from "./db";
import { demoCustomers, demoExpenses, demoInventory, demoSales } from "./demo";
import { businessDate, categories, expiryCutoff, monthRange, type Actor } from "@/lib/domain";
import type { CustomerView, ExpenseView, Overview, SaleView, VariantView } from "@/lib/view-models";

const variantInclude = { product: true, batches: { orderBy: { receivedAt: "desc" as const } } };
function variantView(
  v: Prisma.VariantGetPayload<{ include: typeof variantInclude }>,
  actor: Actor,
): VariantView {
  const cutoff = expiryCutoff();
  return {
    id: v.id,
    productId: v.productId,
    name: v.product.name,
    category: v.product.category,
    type: v.product.type,
    sku: v.sku,
    color: v.color,
    size: v.size,
    braBand: v.braBand,
    braCup: v.braCup,
    bottomSize: v.bottomSize,
    power: v.power,
    priceCents: v.priceCents,
    minStock: v.minStock,
    stock: v.batches.reduce((s, b) => s + b.quantity, 0),
    available: v.batches
      .filter((b) => !b.expiresAt || b.expiresAt >= cutoff)
      .reduce((s, b) => s + b.quantity, 0),
    batches: v.batches.map((b) => ({
      id: b.id,
      code: b.code,
      quantity: b.quantity,
      expiresAt: b.expiresAt?.toISOString().slice(0, 10) ?? null,
      ...(actor.role === "ADMIN" ? { unitCostCents: b.unitCostCents } : {}),
    })),
  };
}
const saleInclude = {
  customer: { select: { name: true } },
  items: { select: { quantity: true, description: true } },
};
function saleView(
  s: Prisma.SaleGetPayload<{ include: typeof saleInclude }>,
  actor: Actor,
): SaleView {
  return {
    id: s.id,
    number: s.number,
    customer: s.customer?.name ?? "Venda avulsa",
    status: s.status,
    paymentStatus: s.paymentStatus,
    paymentMethod: s.paymentMethod,
    totalCents: s.totalCents,
    createdAt: s.createdAt.toISOString(),
    items: s.items.map((i) => `${i.quantity} × ${i.description}`).join("; "),
    ...(actor.role === "ADMIN" ? { costCents: s.costCents } : {}),
  };
}
export async function getInventory(q = "", category = "", page = 1) {
  const actor = await requireActor();
  if (actor.demo) {
    const rows = demoInventory.filter(
      (v) =>
        (!category || v.category === category) &&
        `${v.name} ${v.sku}`.toLowerCase().includes(q.toLowerCase()),
    );
    return { actor, rows: rows.slice((page - 1) * 50, page * 50), total: rows.length };
  }
  const validCategory = z.enum(["LINGERIE", "BEACHWEAR", "WELLNESS"]).safeParse(category);
  const where: Prisma.VariantWhereInput = {
    active: true,
    product: { active: true, ...(validCategory.success ? { category: validCategory.data } : {}) },
    ...(q
      ? {
          OR: [
            { sku: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await db().$transaction([
    db().variant.findMany({
      where,
      include: variantInclude,
      orderBy: { sku: "asc" },
      take: 50,
      skip: (page - 1) * 50,
    }),
    db().variant.count({ where }),
  ]);
  return { actor, rows: rows.map((v) => variantView(v, actor)), total };
}
export async function getCustomers(q = "", page = 1) {
  const actor = await requireActor();
  if (actor.demo) {
    const rows = demoCustomers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
    return { actor, rows, total: rows.length };
  }
  const where = {
    active: true,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [customers, total] = await db().$transaction([
    db().customer.findMany({
      where,
      select: { id: true, name: true, createdAt: true, consentAt: true },
      orderBy: { name: "asc" },
      take: 50,
      skip: (page - 1) * 50,
    }),
    db().customer.count({ where }),
  ]);
  const totals = await db().sale.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customers.map((c) => c.id) }, status: "COMPLETED" },
    _sum: { totalCents: true },
    _count: true,
    _max: { createdAt: true },
  });
  const rows: CustomerView[] = customers.map((c) => {
    const stats = totals.find((s) => s.customerId === c.id);
    return {
      id: c.id,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
      consent: Boolean(c.consentAt),
      purchases: stats?._count ?? 0,
      totalCents: stats?._sum.totalCents ?? 0,
      lastPurchase: stats?._max.createdAt?.toISOString() ?? null,
    };
  });
  return { actor, rows, total };
}
export async function getSales(month = businessDate().slice(0, 7), page = 1) {
  const actor = await requireActor();
  const { start, end } = monthRange(month);
  if (actor.demo) {
    const rows = demoSales.filter(
      (s) => s.createdAt >= start.toISOString() && s.createdAt < end.toISOString(),
    );
    return { actor, rows, total: rows.length };
  }
  const where = { createdAt: { gte: start, lt: end } };
  const [rows, total] = await db().$transaction([
    db().sale.findMany({
      where,
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    db().sale.count({ where }),
  ]);
  return { actor, rows: rows.map((s) => saleView(s, actor)), total };
}
export async function getExpenses(month = businessDate().slice(0, 7)) {
  const actor = await requireActor("manage");
  const { dateStart, dateEnd } = monthRange(month);
  if (actor.demo) return demoExpenses.filter((e) => e.occurredAt.startsWith(month));
  const rows = await db().expense.findMany({
    where: { voidedAt: null, occurredAt: { gte: dateStart, lt: dateEnd } },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map((r): ExpenseView => ({
    id: r.id,
    description: r.description,
    type: r.type,
    amountCents: r.amountCents,
    occurredAt: r.occurredAt.toISOString().slice(0, 10),
  }));
}
export async function getOverview(month = businessDate().slice(0, 7)): Promise<Overview> {
  const actor = await requireActor();
  const { start, end, dateStart, dateEnd } = monthRange(month);
  const cutoff = expiryCutoff();
  const soon = new Date(cutoff.getTime() + 30 * 86400000);
  let inventory: VariantView[],
    sales: { totalCents: number; costCents: number; paymentStatus: string; createdAt: Date }[],
    recent: SaleView[],
    customerCount: number,
    expense = 0,
    proLabore = 0;
  let mix: { label: string; quantity: number }[];
  if (actor.demo) {
    inventory = demoInventory;
    const valid = demoSales.filter(
      (s) => s.createdAt >= start.toISOString() && s.createdAt < end.toISOString(),
    );
    sales = valid.map((s) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      costCents: s.costCents ?? 0,
    }));
    recent = valid.slice(0, 5);
    customerCount = demoCustomers.length;
    expense = demoExpenses
      .filter((e) => e.type === "OPERATING" && e.occurredAt.startsWith(month))
      .reduce((s, e) => s + e.amountCents, 0);
    proLabore = demoExpenses
      .filter((e) => e.type === "PRO_LABORE" && e.occurredAt.startsWith(month))
      .reduce((s, e) => s + e.amountCents, 0);
    mix = Object.entries(categories).map(([k, label]) => ({
      label,
      quantity: inventory.filter((v) => v.category === k).reduce((s, v) => s + v.available, 0),
    }));
  } else {
    // Registros mínimos, sem detalhes de CRM; agregação financeira apenas no servidor.
    const [variants, monthSales, recentSales, customers, expenses] = await db().$transaction([
      db().variant.findMany({
        where: { active: true, product: { active: true } },
        include: variantInclude,
      }),
      db().sale.findMany({
        where: { status: "COMPLETED", createdAt: { gte: start, lt: end } },
        select: {
          totalCents: true,
          costCents: actor.role === "ADMIN",
          paymentStatus: true,
          createdAt: true,
        },
      }),
      db().sale.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: saleInclude,
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db().customer.count({ where: { active: true } }),
      db().expense.groupBy({
        by: ["type"],
        orderBy: { type: "asc" },
        where: {
          voidedAt: null,
          occurredAt: { gte: dateStart, lt: dateEnd },
          ...(actor.role === "ADMIN" ? {} : { id: "00000000-0000-4000-8000-000000000000" }),
        },
        _sum: { amountCents: true },
      }),
    ]);
    inventory = variants.map((v) => variantView(v, actor));
    sales = monthSales;
    recent = recentSales.map((s) => saleView(s, actor));
    customerCount = customers;
    expense = expenses.find((e) => e.type === "OPERATING")?._sum?.amountCents ?? 0;
    proLabore = expenses.find((e) => e.type === "PRO_LABORE")?._sum?.amountCents ?? 0;
    mix = Object.entries(categories).map(([k, label]) => ({
      label,
      quantity: inventory.filter((v) => v.category === k).reduce((s, v) => s + v.available, 0),
    }));
  }
  const revenue = sales.reduce((s, v) => s + v.totalCents, 0);
  const cost = sales.reduce((s, v) => s + (v.costCents ?? 0), 0);
  const paid = sales
    .filter((s) => s.paymentStatus === "PAID")
    .reduce((s, v) => s + v.totalCents, 0);
  const chart = Array.from({ length: 4 }, (_, i) => ({
    label: ["01–07", "08–14", "15–21", "22–fim"][i]!,
    value: sales
      .filter(
        (s) => Math.min(3, Math.floor((Number(businessDate(s.createdAt).slice(8)) - 1) / 7)) === i,
      )
      .reduce((sum, s) => sum + s.totalCents, 0),
  }));
  const alerts = inventory.filter(
    (v) =>
      v.available <= v.minStock ||
      v.batches.some((b) => b.quantity > 0 && b.expiresAt && new Date(b.expiresAt) <= soon),
  );
  return {
    actor,
    month,
    revenue,
    paid,
    receivables: revenue - paid,
    count: sales.length,
    customers: customerCount,
    stock: inventory.reduce((s, v) => s + v.available, 0),
    lowStock: inventory.filter((v) => v.available <= v.minStock).length,
    expiring: inventory.reduce(
      (s, v) =>
        s +
        v.batches.filter((b) => b.quantity > 0 && b.expiresAt && new Date(b.expiresAt) <= soon)
          .length,
      0,
    ),
    ...(actor.role === "ADMIN"
      ? { cost, expenses: expense, proLabore, profit: revenue - cost - expense - proLabore }
      : {}),
    chart,
    mix,
    recent,
    alerts: alerts.slice(0, 5),
  };
}
