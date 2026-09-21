import { z } from "zod";

export const categories = {
  LINGERIE: "Lingerie",
  BEACHWEAR: "Moda praia",
  WELLNESS: "Bem-estar íntimo",
} as const;
export const productTypes = {
  SET: "Conjunto",
  TOP: "Peça superior",
  BOTTOM: "Peça inferior",
  COSMETIC: "Cosmético",
  ELECTRONIC: "Eletrônico",
  ACCESSORY: "Acessório",
} as const;
export const payments = {
  PIX: "Pix",
  CASH: "Dinheiro",
  DEBIT: "Cartão de débito",
  CREDIT: "Cartão de crédito",
  TRANSFER: "Transferência",
} as const;
export type Role = "ADMIN" | "OPERATOR";
export type Actor = { id: string; name: string; role: Role; demo: boolean };
export type ActionResult = { ok: boolean; message: string };
export const cents = z.number().int().min(0).max(100_000_000);
const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).default("");
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida.");
export const customerSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: text(100).min(2),
    phone: text(25).regex(/^[+\d\s()-]*$/, "Telefone inválido."),
    braSize: optionalText(20),
    bottomSize: optionalText(20),
    notes: optionalText(1500),
    consent: z.boolean(),
  })
  .refine((v) => v.consent || (!v.braSize && !v.bottomSize && !v.notes), {
    message: "Registre a autorização da cliente antes de guardar medidas ou preferências.",
    path: ["consent"],
  });
export const productSchema = z
  .object({
    productId: z.string().uuid().optional(),
    name: text(120).min(2),
    category: z.enum(["LINGERIE", "BEACHWEAR", "WELLNESS"]),
    type: z.enum(["SET", "TOP", "BOTTOM", "COSMETIC", "ELECTRONIC", "ACCESSORY"]),
    sku: text(50)
      .min(2)
      .regex(/^[\w.-]+$/, "Use letras, números, ponto, hífen ou sublinhado no SKU."),
    color: text(50).min(1),
    size: text(30).min(1),
    braBand: z.number().int().min(28).max(70).nullable(),
    braCup: optionalText(3),
    bottomSize: optionalText(20),
    power: optionalText(60),
    priceCents: cents.positive(),
    minStock: z.number().int().min(0).max(10000),
  })
  .refine((v) => v.type !== "ELECTRONIC" || v.power.length > 0, {
    message: "Informe a alimentação do eletrônico.",
    path: ["power"],
  });
export const receiptSchema = z.object({
  variantId: z.string().uuid(),
  code: text(60).min(1),
  quantity: z.number().int().min(1).max(10000),
  unitCostCents: cents,
  expiresAt: calendarDate.or(z.literal("")),
});
export const saleSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    paymentMethod: z.enum(["PIX", "CASH", "DEBIT", "CREDIT", "TRANSFER"]),
    paymentStatus: z.enum(["PAID", "PENDING"]),
    discountCents: cents,
    items: z
      .array(
        z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(1000) }),
      )
      .min(1)
      .max(30),
  })
  .refine((s) => new Set(s.items.map((i) => i.variantId)).size === s.items.length, {
    message: "Uma variação deve aparecer uma única vez na venda.",
    path: ["items"],
  });
export const expenseSchema = z.object({
  description: text(160).min(3),
  type: z.enum(["OPERATING", "PRO_LABORE"]),
  amountCents: cents.positive(),
  occurredAt: calendarDate,
});
export const adjustmentSchema = z.object({
  batchId: z.string().uuid(),
  delta: z
    .number()
    .int()
    .min(-10000)
    .max(10000)
    .refine((v) => v !== 0),
  reason: text(160).min(8),
});
export function can(role: Role, permission: "operate" | "manage") {
  return permission === "operate" || role === "ADMIN";
}
export class BusinessError extends Error {}
export function saleTotal(subtotal: number, discount: number) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal > 100_000_000 ||
    subtotal <= 0 ||
    !Number.isSafeInteger(discount) ||
    discount < 0 ||
    discount > subtotal
  )
    throw new BusinessError("Valor ou desconto inválido.");
  return subtotal - discount;
}
export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function expiryCutoff(now = new Date()) {
  return new Date(`${businessDate(now)}T00:00:00.000Z`);
}
export function monthRange(month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 2020 ||
    Number(month.slice(0, 4)) > 2100
  )
    throw new BusinessError("Mês inválido.");
  const [y, m] = month.split("-").map(Number) as [number, number];
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 3)),
    end: new Date(Date.UTC(y, m, 1, 3)),
    dateStart: new Date(Date.UTC(y, m - 1, 1)),
    dateEnd: new Date(Date.UTC(y, m, 1)),
  };
}
