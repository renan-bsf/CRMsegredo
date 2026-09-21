import { getExpenses, getFinanceOverview } from "@/lib/server/queries";
import { requireActor } from "@/lib/server/auth";
import { money } from "@/lib/utils";
import { monthParam } from "@/lib/params";
import { PageHeading, MonthPicker, Empty } from "@/components/common";
import { ExpenseForm, VoidExpenseButton } from "@/components/forms";
export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireActor("manage");
  const month = monthParam((await searchParams).month);
  const [d, expenses] = await Promise.all([getFinanceOverview(month), getExpenses(month)]);
  const dre = [
    { label: "Vendas líquidas de descontos", value: d.revenue },
    { label: "Custo das mercadorias vendidas", value: -(d.cost ?? 0) },
    { label: "Resultado bruto", value: d.revenue - (d.cost ?? 0), strong: true },
    { label: "Despesas operacionais", value: -(d.expenses ?? 0) },
    { label: "Pró-labore", value: -(d.proLabore ?? 0) },
    { label: "Resultado gerencial", value: d.profit ?? 0, strong: true },
  ];
  return (
    <>
      <PageHeading
        eyebrow="EXCLUSIVO DOS SÓCIOS"
        title="Financeiro"
        description="Entenda os resultados e registre os gastos do negócio."
      >
        <MonthPicker month={month} />
        <ExpenseForm />
      </PageHeading>
      <div className="mb-6 grid gap-5 md:grid-cols-3">
        {[
          { l: "Resultado do mês", v: d.profit ?? 0, n: "Vendas − custos − despesas − pró-labore" },
          { l: "Recebido das vendas do mês", v: d.paid, n: "Pagamentos já conferidos" },
          { l: "A receber das vendas do mês", v: d.receivables, n: "Pagamentos pendentes" },
        ].map((m) => (
          <div key={m.l} className="panel metric">
            <p className="text-sm text-muted-foreground">{m.l}</p>
            <p className="metric-value sensitive">{money(m.v)}</p>
            <p className="metric-note">{m.n}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[.8fr_1.2fr]">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>DRE gerencial simplificada</h2>
              <p>Competência do mês selecionado</p>
            </div>
          </div>
          <div className="px-6 pb-5">
            {dre.map((line, i) => (
              <div
                key={line.label}
                className={`flex items-center justify-between gap-4 border-b py-4 text-sm ${line.strong ? "font-semibold" : "text-muted-foreground"} ${i === dre.length - 1 ? "border-0 text-primary" : ""}`}
              >
                <span>{line.label}</span>
                <span className="sensitive whitespace-nowrap">{money(line.value)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Despesas e pró-labore</h2>
              <p>Lançamentos ativos do período</p>
            </div>
          </div>
          {expenses.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Lançamento</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>
                      <span className="sr-only">Anular</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="min-w-44">
                        {e.description}
                        <p className="sub">
                          {e.type === "PRO_LABORE" ? "Pró-labore" : "Despesa operacional"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {e.occurredAt.split("-").reverse().join("/")}
                      </td>
                      <td className="sensitive whitespace-nowrap font-medium">
                        {money(e.amountCents)}
                      </td>
                      <td>
                        <VoidExpenseButton id={e.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum lançamento"
              description="Registre despesas e pró-labore para compor o resultado."
            />
          )}
        </section>
      </div>
      <p className="mt-5 max-w-4xl text-xs leading-relaxed text-muted-foreground">
        Demonstrativo operacional simplificado, sem apuração fiscal. Vendas entram na data do
        registro, mesmo quando a receber; cancelamentos retiram a venda do mês de origem. Custos
        usam os lotes vendidos. Entradas de estoque não são lançadas novamente como despesa. Os
        valores recebidos não representam o saldo de uma conta bancária.
      </p>
    </>
  );
}
