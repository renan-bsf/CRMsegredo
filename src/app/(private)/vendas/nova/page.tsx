import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActor } from "@/lib/server/auth";
import { findSaleCustomers, findSaleProducts } from "@/app/lookup-actions";
import { PageHeading } from "@/components/common";
import { SaleComposer } from "@/components/sale-composer";
import { Button } from "@/components/ui/button";
export default async function NewSalePage() {
  const actor = await requireActor();
  const [products, customers] = await Promise.all([findSaleProducts(""), findSaleCustomers("")]);
  return (
    <>
      <PageHeading
        eyebrow="ATENDIMENTO E VENDA DIRETA"
        title="Nova venda"
        description="Escolha as variações e registre o pagamento combinado."
      >
        <Button asChild variant="outline">
          <Link href="/vendas">
            <ArrowLeft />
            Voltar às vendas
          </Link>
        </Button>
      </PageHeading>
      <SaleComposer products={products} customers={customers} demo={actor.demo} />
    </>
  );
}
