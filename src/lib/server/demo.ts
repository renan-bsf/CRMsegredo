import "server-only";
import type { CustomerView, ExpenseView, SaleView, VariantView } from "@/lib/view-models";
import { businessDate } from "@/lib/domain";
export const demoId = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const today = businessDate();
const month = today.slice(0, 7);
const future = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
const base = { braBand: null, braCup: null, bottomSize: null, power: null, minStock: 3 };
export const demoInventory: VariantView[] = [
  {
    ...base,
    id: demoId(10),
    productId: demoId(110),
    name: "Conjunto Aurora",
    category: "LINGERIE",
    type: "SET",
    sku: "AUR-40B-ROS",
    color: "Rosa antigo",
    size: "40B / M",
    braBand: 40,
    braCup: "B",
    bottomSize: "M",
    priceCents: 18990,
    stock: 14,
    available: 14,
    batches: [
      { id: demoId(210), code: "AUR-001", quantity: 14, expiresAt: null, unitCostCents: 7600 },
    ],
  },
  {
    ...base,
    id: demoId(11),
    productId: demoId(111),
    name: "Sutiã Essencial",
    category: "LINGERIE",
    type: "TOP",
    sku: "ESS-42C-PRE",
    color: "Preto",
    size: "42C",
    braBand: 42,
    braCup: "C",
    priceCents: 9990,
    stock: 2,
    available: 2,
    batches: [
      { id: demoId(211), code: "ESS-001", quantity: 2, expiresAt: null, unitCostCents: 4200 },
    ],
  },
  {
    ...base,
    id: demoId(12),
    productId: demoId(112),
    name: "Calcinha Renda Leve",
    category: "LINGERIE",
    type: "BOTTOM",
    sku: "REN-M-OFF",
    color: "Off-white",
    size: "M",
    bottomSize: "M",
    priceCents: 4990,
    stock: 26,
    available: 26,
    batches: [
      { id: demoId(212), code: "REN-001", quantity: 26, expiresAt: null, unitCostCents: 1800 },
    ],
  },
  {
    ...base,
    id: demoId(13),
    productId: demoId(113),
    name: "Biquíni Maré · top",
    category: "BEACHWEAR",
    type: "TOP",
    sku: "MAR-M-TER",
    color: "Terracota",
    size: "M",
    priceCents: 12990,
    stock: 8,
    available: 8,
    batches: [
      { id: demoId(213), code: "MAR-001", quantity: 8, expiresAt: null, unitCostCents: 5100 },
    ],
  },
  {
    ...base,
    id: demoId(14),
    productId: demoId(114),
    name: "Biquíni Maré · calcinha",
    category: "BEACHWEAR",
    type: "BOTTOM",
    sku: "MAR-G-TER",
    color: "Terracota",
    size: "G",
    bottomSize: "G",
    priceCents: 8990,
    stock: 11,
    available: 11,
    batches: [
      { id: demoId(214), code: "MAR-002", quantity: 11, expiresAt: null, unitCostCents: 3600 },
    ],
  },
  {
    ...base,
    id: demoId(15),
    productId: demoId(115),
    name: "Gel íntimo neutro",
    category: "WELLNESS",
    type: "COSMETIC",
    sku: "GEL-100-NEU",
    color: "Neutro",
    size: "100 ml",
    priceCents: 3990,
    stock: 3,
    available: 3,
    batches: [
      { id: demoId(215), code: "GEL-042", quantity: 3, expiresAt: future, unitCostCents: 1500 },
    ],
  },
  {
    ...base,
    id: demoId(16),
    productId: demoId(116),
    name: "Massageador Luna",
    category: "WELLNESS",
    type: "ELECTRONIC",
    sku: "LUN-UNI-VIN",
    color: "Vinho",
    size: "Único",
    power: "Bateria recarregável USB 5V",
    priceCents: 15990,
    stock: 6,
    available: 6,
    batches: [
      { id: demoId(216), code: "LUN-001", quantity: 6, expiresAt: null, unitCostCents: 6700 },
    ],
  },
];
const customerNames = [
  "Marina A. (exemplo)",
  "Camila R. (exemplo)",
  "Beatriz S. (exemplo)",
  "Juliana M. (exemplo)",
  "Fernanda L. (exemplo)",
];
export const demoSales: SaleView[] = Array.from({ length: 18 }, (_, i): SaleView => {
  const variant = demoInventory[i % demoInventory.length]!;
  const day = Math.min(Number(today.slice(8)), 1 + Math.floor((i * Number(today.slice(8))) / 18));
  return {
    id: demoId(300 + i),
    number: 1001 + i,
    customer: customerNames[i % 5]!,
    status: "COMPLETED",
    paymentStatus: i % 5 === 0 ? "PENDING" : "PAID",
    paymentMethod: i % 3 === 0 ? "CREDIT" : "PIX",
    totalCents: variant.priceCents * ((i % 3) + 1),
    costCents: variant.batches[0]!.unitCostCents! * ((i % 3) + 1),
    createdAt: `${month}-${String(day).padStart(2, "0")}T15:00:00Z`,
    items: `${(i % 3) + 1} × ${variant.name}`,
  };
}).reverse();
export const demoCustomers: CustomerView[] = customerNames.map((name, i) => {
  const purchases = demoSales.filter((s) => s.customer === name);
  return {
    id: demoId(400 + i),
    name,
    createdAt: `${month}-01T15:00:00Z`,
    purchases: purchases.length,
    totalCents: purchases.reduce((a, b) => a + b.totalCents, 0),
    lastPurchase: purchases[0]?.createdAt ?? null,
    consent: i < 3,
  };
});
export const demoExpenses: ExpenseView[] = [
  {
    id: demoId(500),
    description: "Aluguel do espaço (exemplo)",
    type: "OPERATING",
    amountCents: 65000,
    occurredAt: `${month}-05`,
  },
  {
    id: demoId(501),
    description: "Embalagens (exemplo)",
    type: "OPERATING",
    amountCents: 14800,
    occurredAt: `${month}-08`,
  },
  {
    id: demoId(502),
    description: "Pró-labore (exemplo)",
    type: "PRO_LABORE",
    amountCents: 50000,
    occurredAt: `${month}-10`,
  },
];
