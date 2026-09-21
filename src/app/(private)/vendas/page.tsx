import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeading, MonthPicker, Pagination } from "@/components/common";
import { Button } from "@/components/ui/button";
import { SalesTable } from "@/components/sales-table";
import { getSales } from "@/lib/server/queries";
import { pageParam, monthParam } from "@/lib/params";
export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; page?: string }>;
}) {
  const p = await searchParams,
    month = monthParam(p.month),
    page = pageParam(p.page);
  const { rows, actor, total } = await getSales(month, page);
  return (
    <>
      <PageHeading
        eyebrow="CADA VENDA, UM NOVO VÍNCULO"
        title="Vendas"
        description="Registre vendas diretas e acompanhe os recebimentos."
      >
        <MonthPicker month={month} />
        <Button asChild>
          <Link href="/vendas/nova">
            <Plus />
            Nova venda
          </Link>
        </Button>
      </PageHeading>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Vendas do período</h2>
            <p>Pagamentos registrados manualmente após conferência</p>
          </div>
        </div>
        <SalesTable rows={rows} admin={actor.role === "ADMIN"} />
        <Pagination total={total} page={page} base="/vendas" params={{ month }} />
      </section>
    </>
  );
}
