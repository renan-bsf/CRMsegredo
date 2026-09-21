import { z } from "zod";
import { calendarDate, cents, BusinessError } from "./domain";
export const purchaseKinds = {
  ORDER: "Pedido de compra",
  INVOICE: "Nota fiscal de entrada",
} as const;
export const purchaseStatuses = {
  REGISTERED: "Registrado",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
} as const;
export const purchaseSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    kind: z.enum(["ORDER", "INVOICE"]),
    supplierName: z.string().trim().min(2).max(160),
    supplierTaxId: z
      .string()
      .transform((s) => s.replace(/[.\/\-\s]/g, ""))
      .pipe(z.string().regex(/^\d{14}$/, "Informe os 14 dígitos do CNPJ do fornecedor.")),
    number: z.string().trim().min(1).max(40),
    series: z.string().trim().max(10).default(""),
    accessKey: z
      .string()
      .trim()
      .regex(/^(\d{44})?$/, "A chave da NF-e deve conter 44 dígitos.")
      .default(""),
    issuedAt: calendarDate,
    expectedAt: calendarDate.or(z.literal("")).default(""),
    sourceOrderId: z.string().uuid().nullable().default(null),
    notes: z.string().trim().max(2000).default(""),
    items: z
      .array(
        z.object({
          variantId: z.string().uuid(),
          quantity: z.number().int().min(1).max(10000),
          unitCostCents: cents.positive(),
          lotCode: z.string().trim().max(60),
          expiresAt: calendarDate.or(z.literal("")),
        }),
      )
      .min(1, "Inclua ao menos um produto.")
      .max(50),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "ORDER" && (data.accessKey || data.sourceOrderId))
      ctx.addIssue({
        code: "custom",
        message: "Pedidos não possuem chave de NF-e nem pedido de origem.",
      });
    if (data.kind === "INVOICE" && data.items.some((item) => !item.lotCode))
      ctx.addIssue({ code: "custom", message: "Informe o lote de cada item da nota fiscal." });
    if (new Set(data.items.map((i) => i.variantId + ":" + i.lotCode)).size !== data.items.length)
      ctx.addIssue({ code: "custom", message: "Agrupe itens repetidos da mesma variação e lote." });
  });
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export function purchaseTotal(items: { quantity: number; unitCostCents: number }[]) {
  const total = items.reduce((sum, item) => sum + item.quantity * item.unitCostCents, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000)
    throw new BusinessError("O total dos produtos deve estar entre R$ 0,01 e R$ 1.000.000,00.");
  return total;
}
