import { ShieldCheck } from "lucide-react";
import { PageHeading, SearchForm, Empty, Pagination } from "@/components/common";
import { CustomerForm, CustomerDetails } from "@/components/forms";
import { getCustomers } from "@/lib/server/queries";
import { money, dateLabel } from "@/lib/utils";
import { pageParam, queryParam } from "@/lib/params";
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const p = await searchParams,
    q = queryParam(p.q),
    page = pageParam(p.page);
  const { rows, actor, total } = await getCustomers(q, page);
  return (
    <>
      <PageHeading
        eyebrow="RELACIONAMENTO COM DISCRIÇÃO"
        title="Clientes"
        description="Conheça suas clientes e acolha cada preferência."
      >
        <CustomerForm />
      </PageHeading>
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e6dce4] bg-[#f9f2f6] p-4 text-sm text-[#815167]">
        <ShieldCheck size={20} className="shrink-0" />
        <p>
          Contatos, medidas e preferências aparecem somente ao abrir o perfil. Registre medidas e
          preferências com autorização da cliente.
        </p>
      </div>
      <section className="panel">
        <div className="p-5">
          <SearchForm q={q} placeholder="Buscar pelo nome de atendimento" />
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Relacionamento</th>
                  <th>Última compra</th>
                  <th>Total em compras</th>
                  <th>
                    <span className="sr-only">Perfil</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="top-avatar">{c.name.slice(0, 1)}</span>
                        <div>
                          <strong className="font-medium">{c.name}</strong>
                          <p className="sub">Desde {dateLabel(c.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {c.purchases} compra{c.purchases !== 1 ? "s" : ""}
                    </td>
                    <td className="text-muted-foreground">
                      {c.lastPurchase ? dateLabel(c.lastPurchase) : "Ainda sem compras"}
                    </td>
                    <td className="sensitive font-medium">{money(c.totalCents)}</td>
                    <td>
                      <CustomerDetails customer={c} admin={actor.role === "ADMIN"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma cliente encontrada"
            description="Comece um relacionamento cadastrando a primeira cliente."
          />
        )}
        <Pagination total={total} page={page} base="/clientes" params={{ q }} />
      </section>
    </>
  );
}
