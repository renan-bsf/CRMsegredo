import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { allocateStock } from "@/lib/stock";
import {
  saleSchema,
  saleTotal,
  customerSchema,
  monthRange,
  expiryCutoff,
  can,
  calendarDate,
} from "@/lib/domain";
import { encrypt, decrypt } from "@/lib/server/crypto";
import { isDemo } from "@/lib/server/config";
const id = "00000000-0000-4000-8000-000000000001";
describe("integridade da venda", () => {
  it("rejeita quantidades negativas e variações duplicadas", () => {
    const sale = {
      idempotencyKey: id,
      customerId: null,
      paymentMethod: "PIX",
      paymentStatus: "PAID",
      discountCents: 0,
      items: [{ variantId: id, quantity: 1 }],
    };
    expect(saleSchema.safeParse(sale).success).toBe(true);
    expect(
      saleSchema.safeParse({ ...sale, items: [{ variantId: id, quantity: -1 }] }).success,
    ).toBe(false);
    expect(saleSchema.safeParse({ ...sale, items: [...sale.items, ...sale.items] }).success).toBe(
      false,
    );
  });
  it("mantém centavos exatos e recusa desconto acima da venda ou overflow", () => {
    expect(saleTotal(1990 * 3, 100)).toBe(5870);
    expect(() => saleTotal(100, 101)).toThrow();
    expect(() => saleTotal(100, -1)).toThrow();
    expect(() => saleTotal(100_000_001, 0)).toThrow();
  });
  it("aloca por FEFO, ignora vencidos e preserva o custo por lote", () => {
    const lots = [
      {
        id: "no-expiry",
        quantity: 10,
        unitCostCents: 900,
        expiresAt: null,
        receivedAt: new Date("2026-01-01"),
      },
      {
        id: "old",
        quantity: 100,
        unitCostCents: 100,
        expiresAt: new Date("2026-09-19"),
        receivedAt: new Date("2026-01-01"),
      },
      {
        id: "soon",
        quantity: 2,
        unitCostCents: 200,
        expiresAt: new Date("2026-09-20"),
        receivedAt: new Date("2026-02-01"),
      },
    ];
    expect(allocateStock(lots, 3, new Date("2026-09-20"))).toEqual([
      { batchId: "soon", quantity: 2, costCents: 400 },
      { batchId: "no-expiry", quantity: 1, costCents: 900 },
    ]);
    expect(() => allocateStock(lots, 13, new Date("2026-09-20"))).toThrow(/insuficiente/);
    expect(lots[0]?.quantity).toBe(10);
  });
  it("usa o dia brasileiro para vencimentos e limites mensais", () => {
    expect(expiryCutoff(new Date("2026-09-21T01:00:00Z")).toISOString()).toBe(
      "2026-09-20T00:00:00.000Z",
    );
    expect(monthRange("2026-12").end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    expect(calendarDate.safeParse("2026-02-30").success).toBe(false);
    expect(() => monthRange("2026-13")).toThrow();
  });
});
describe("privacidade e autorização", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it("exige consentimento para medidas e observações", () => {
    expect(
      customerSchema.safeParse({ name: "Cliente teste", phone: "", consent: false, braSize: "40B" })
        .success,
    ).toBe(false);
    expect(
      customerSchema.safeParse({ name: "Cliente teste", phone: "", consent: true, braSize: "40B" })
        .success,
    ).toBe(true);
  });
  it("criptografa com nonce aleatório e detecta troca ou adulteração", () => {
    process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const a = encrypt("preferência privada", id),
      b = encrypt("preferência privada", id);
    expect(a).not.toBe(b);
    expect(a).not.toContain("preferência");
    expect(decrypt(a, id)).toBe("preferência privada");
    expect(() => decrypt(a, "outro-cliente")).toThrow();
    const fields = a.split(".");
    fields[3] = Buffer.from("adulterado").toString("base64");
    expect(() => decrypt(fields.join("."), id)).toThrow();
  });
  it("não autoriza operador nas funções dos sócios", () => {
    expect(can("OPERATOR", "manage")).toBe(false);
    expect(can("OPERATOR", "operate")).toBe(true);
    expect(can("ADMIN", "manage")).toBe(true);
  });
  it("bloqueia o bypass de demonstração em produção", () => {
    process.env.DEMO_MODE = "true";
    Object.assign(process.env, { NODE_ENV: "production" });
    expect(isDemo()).toBe(false);
    Object.assign(process.env, { NODE_ENV: "development" });
    expect(isDemo()).toBe(true);
  });
});
