import { notFound } from "next/navigation";
import { requireActor } from "@/lib/server/auth";
import { getPurchase } from "@/lib/server/purchase-queries";
import { PurchaseForm, type PurchasePrefill } from "@/components/purchase-form";
import { PageHeading } from "@/components/common";
export default async function NewPurchase({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  await requireActor("manage");
  const { pedido } = await searchParams;
  let prefill: PurchasePrefill | undefined;
  if (pedido) {
    const order = await getPurchase(pedido);
    if (!order || order.kind !== "ORDER" || order.status === "CANCELLED") notFound();
    prefill = {
      orderId: order.id,
      supplierName: order.supplierName,
      supplierTaxId: order.supplierTaxId,
      items: order.items.map((i) => ({
        variantId: i.variantId,
        label: i.description,
        quantity: i.quantity,
        unitCostCents: i.unitCostCents,
        lotCode: i.lotCode,
        expiresAt: i.expiresAt?.toISOString().slice(0, 10) ?? "",
        cosmetic: i.variant.product.type === "COSMETIC",
      })),
    };
  }
  return (
    <>
      <PageHeading
        eyebrow="REGISTRO DE ENTRADA"
        title={prefill ? "Nota fiscal do pedido" : "Novo pedido ou nota fiscal"}
        description="Confira os dados do documento e os produtos antes de registrar."
      />
      <PurchaseForm prefill={prefill} />
    </>
  );
}
