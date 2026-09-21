import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { getPurchases } from "@/lib/server/purchase-queries";
import { pageParam, queryParam } from "@/lib/params";
import { purchaseKinds, purchaseStatuses } from "@/lib/purchasing";
import { money } from "@/lib/utils";
import { PageHeading, Empty, Pagination, SearchForm } from "@/components/common";
import { Select } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = queryParam(params.q),
    kind = Object.hasOwn(purchaseKinds, params.kind ?? "") ? params.kind! : "",
    status = Object.hasOwn(purchaseStatuses, params.status ?? "") ? params.status! : "",
    page = pageParam(params.page);
  const { rows, total } = await getPurchases(q, kind, status, page);
  return (
    <>
      <PageHeading
        eyebrow="COMPRAS E RECEBIMENTOS"
        title="Compras e notas fiscais"
        description="Organize pedidos, registre notas de entrada e confira as mercadorias recebidas."
      >
        <Button asChild>
          <Link href="/compras/nova">
            <Plus />
            Novo registro
          </Link>
        </Button>
      </PageHeading>
      <section className="panel min-w-0">
        <div className="p-5">
          <SearchForm q={q} placeholder="Fornecedor, CNPJ, número ou chave">
            <Select aria-label="Tipo de documento" name="kind" defaultValue={kind}>
              <option value="">Todos os documentos</option>
              {Object.entries(purchaseKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select aria-label="Situação" name="status" defaultValue={status}>
              <option value="">Todas as situações</option>
              {Object.entries(purchaseStatuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </SearchForm>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Fornecedor</th>
                  <th>Emissão</th>
                  <th>Total dos produtos</th>
                  <th>Situação</th>
                  <th>Consulta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <span className="font-medium">
                        {purchaseKinds[doc.kind]} · {doc.number}
                        {doc.series && "/" + doc.series}
                      </span>
                      <p className="sub">{doc._count.items} itens</p>
                    </td>
                    <td>{doc.supplierName}</td>
                    <td className="whitespace-nowrap">
                      {doc.issuedAt.toISOString().slice(0, 10).split("-").reverse().join("/")}
                    </td>
                    <td className="sensitive whitespace-nowrap">{money(doc.totalCents)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (doc.status === "RECEIVED"
                            ? "badge-green"
                            : doc.status === "CANCELLED"
                              ? "badge-red"
                              : "badge-amber")
                        }
                      >
                        {purchaseStatuses[doc.status]}
                      </span>
                    </td>
                    <td>
                      <Button asChild variant="outline" size="sm">
                        <Link href={"/compras/" + doc.id}>
                          <FileText size={16} />
                          Detalhes
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum documento encontrado"
            description="Registre um pedido de compra ou uma nota fiscal de entrada, ou ajuste os filtros."
          />
        )}
        <Pagination page={page} total={total} base="/compras" params={{ q, kind, status }} />
      </section>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Registro interno de documentos. A chave da NF-e é uma referência; não há emissão fiscal nem
        consulta automática à SEFAZ. Compras só alteram o estoque após confirmar o recebimento da
        nota e não são lançadas novamente como despesa na DRE.
      </p>
    </>
  );
}
