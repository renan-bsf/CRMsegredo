import { PageHeading, SearchForm, Empty, Pagination } from "@/components/common";
import { ProductForm, ReceiptForm, VariantDetails } from "@/components/forms";
import { Select } from "@/components/ui/fields";
import { getInventory } from "@/lib/server/queries";
import { categories, productTypes } from "@/lib/domain";
import { money } from "@/lib/utils";
import { pageParam, queryParam } from "@/lib/params";
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const p = await searchParams,
    q = queryParam(p.q),
    category = Object.keys(categories).includes(p.category ?? "") ? p.category! : "",
    page = pageParam(p.page);
  const { rows, actor, total } = await getInventory(q, category, page);
  const admin = actor.role === "ADMIN";
  return (
    <>
      <PageHeading
        eyebrow="DO RECEBIMENTO À VENDA"
        title="Produtos e estoque"
        description="Cuide de cada variação, lote e reposição."
      >
        {admin && (
          <>
            <ReceiptForm variants={rows} />
            <ProductForm />
          </>
        )}
      </PageHeading>
      <section className="panel">
        <div className="p-5">
          <SearchForm q={q} placeholder="Buscar produto ou SKU">
            <Select name="category" defaultValue={category} className="w-44" aria-label="Universo">
              <option value="">Todos os universos</option>
              {Object.entries(categories).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
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
                  <th>Produto / variação</th>
                  <th>Universo</th>
                  <th>Preço</th>
                  <th>Disponível</th>
                  <th>Situação</th>
                  <th>
                    <span className="sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <span className="font-medium">{v.name}</span>
                      <p className="sub">
                        {v.sku} · {v.color} · {v.size}
                      </p>
                    </td>
                    <td>
                      <span
                        className={`badge ${v.category === "LINGERIE" ? "badge-rose" : v.category === "BEACHWEAR" ? "badge-amber" : "badge-blue"}`}
                      >
                        {categories[v.category]}
                      </span>
                      <p className="sub">{productTypes[v.type]}</p>
                    </td>
                    <td className="sensitive whitespace-nowrap">{money(v.priceCents)}</td>
                    <td className="font-medium">
                      {v.available}{" "}
                      <span className="text-xs font-normal text-muted-foreground">un.</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${v.available === 0 ? "badge-red" : v.available <= v.minStock ? "badge-amber" : "badge-green"}`}
                      >
                        {v.available === 0
                          ? "Sem estoque"
                          : v.available <= v.minStock
                            ? "Repor"
                            : "Em dia"}
                      </span>
                      {v.stock > v.available && (
                        <p className="sub text-destructive">{v.stock - v.available} vencidos</p>
                      )}
                    </td>
                    <td>
                      <VariantDetails variant={v} admin={admin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum produto encontrado"
            description="Cadastre um produto ou ajuste os filtros da busca."
          />
        )}
        <Pagination page={page} total={total} base="/estoque" params={{ q, category }} />
      </section>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        O saldo disponível exclui lotes vencidos. Vendas consomem primeiro os lotes com vencimento
        mais próximo. Peças de conjunto e peças avulsas têm SKUs próprios.
      </p>
    </>
  );
}
