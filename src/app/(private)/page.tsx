import Link from "next/link";
import {
  ArrowRight,
  Plus,
  Wallet,
  ShoppingBag,
  Package,
  TrendingUp,
  TriangleAlert,
  Clock3,
} from "lucide-react";
import { getOverview } from "@/lib/server/queries";
import { monthParam } from "@/lib/params";
import { money } from "@/lib/utils";
import { PageHeading, MonthPicker } from "@/components/common";
import { Button } from "@/components/ui/button";
import { SalesTable } from "@/components/sales-table";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; denied?: string }>;
}) {
  const params = await searchParams;
  const month = monthParam(params.month);
  const d = await getOverview(month);
  const max = Math.max(1, ...d.chart.map((c) => c.value));
  const stockTotal = Math.max(
    1,
    d.mix.reduce((s, m) => s + m.quantity, 0),
  );
  const metrics = [
    {
      label: "Vendas no mês",
      value: money(d.revenue),
      note: `${d.count} vendas realizadas`,
      icon: Wallet,
    },
    {
      label: d.actor.role === "ADMIN" ? "Resultado gerencial" : "Recebido dessas vendas",
      value: money(d.actor.role === "ADMIN" ? (d.profit ?? 0) : d.paid),
      note:
        d.actor.role === "ADMIN" ? "Após custos, despesas e pró-labore" : "Pagamentos confirmados",
      icon: TrendingUp,
    },
    {
      label: "Ticket médio",
      value: money(d.count ? Math.round(d.revenue / d.count) : 0),
      note: "Valor médio por venda",
      icon: ShoppingBag,
    },
    {
      label: "Estoque disponível",
      value: String(d.stock),
      note: `${d.lowStock} variações para repor`,
      icon: Package,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="CADA DETALHE DO SEU NEGÓCIO"
        title="Visão geral"
        description="Um olhar sobre a operação e os resultados do mês."
      >
        <MonthPicker month={month} />
        <Button asChild>
          <Link href="/vendas/nova">
            <Plus />
            Nova venda
          </Link>
        </Button>
      </PageHeading>
      {params.denied && (
        <p role="alert" className="mb-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Esta área é exclusiva dos sócios administradores.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map((m) => (
          <div className="panel metric" key={m.label}>
            <div className="metric-label">
              <span>{m.label}</span>
              <span className="metric-icon">
                <m.icon size={17} />
              </span>
            </div>
            <p className={`metric-value ${m.icon !== Package ? "sensitive" : ""}`}>{m.value}</p>
            <p className="metric-note">{m.note}</p>
          </div>
        ))}
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Ritmo das vendas</h2>
              <p>Vendas concluídas por semana do mês</p>
            </div>
            <span className="badge badge-rose">{month.split("-").reverse().join(" / ")}</span>
          </div>
          <div className="px-6 pb-6">
            <div className="mb-6 flex items-end gap-3">
              <strong className="sensitive text-3xl font-semibold tracking-tight">
                {money(d.revenue)}
              </strong>
              <span className="mb-1 text-xs text-muted-foreground">no período</span>
            </div>
            <div
              className="chart-grid flex h-44 items-end justify-around gap-5 border-b px-4"
              role="img"
              aria-label={`Vendas semanais: ${d.chart.map((c) => `${c.label}: ${money(c.value)}`).join(", ")}`}
            >
              {d.chart.map((c, i) => (
                <div key={c.label} className="group relative flex h-full w-full max-w-20 items-end">
                  <div
                    className={`w-full rounded-t-md ${i === 2 ? "bg-[#9b3657]" : "bg-[#e6c1cf]"}`}
                    style={{ height: c.value ? `${Math.max(3, (c.value / max) * 90)}%` : "2px" }}
                  />
                  <span className="sensitive pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 group-hover:opacity-100">
                    {money(c.value)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-around gap-5 px-4 text-xs text-muted-foreground">
              {d.chart.map((c) => (
                <span className="w-full max-w-20 text-center" key={c.label}>
                  {c.label}
                </span>
              ))}
            </div>
            <details className="mt-4 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Ver valores por semana</summary>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {d.chart.map((c) => (
                  <li key={c.label}>
                    {c.label}: <span className="sensitive">{money(c.value)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>O que merece atenção</h2>
              <p>Cuidados para manter tudo em dia</p>
            </div>
            <TriangleAlert size={19} className="text-[#bd8a46]" />
          </div>
          <div className="space-y-3 px-6 pb-5">
            <Link href="/estoque" className="flex items-center gap-3 rounded-lg bg-[#fcf5eb] p-4">
              <span className="rounded-lg bg-white p-2 text-[#ae7d39]">
                <Package size={18} />
              </span>
              <div className="flex-1">
                <strong className="text-sm font-medium">
                  {d.lowStock} variações com estoque baixo
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confira os itens para reposição
                </p>
              </div>
              <ArrowRight size={16} className="text-[#b49366]" />
            </Link>
            <Link href="/estoque" className="flex items-center gap-3 rounded-lg bg-[#f5f0f7] p-4">
              <span className="rounded-lg bg-white p-2 text-[#9675a2]">
                <Clock3 size={18} />
              </span>
              <div className="flex-1">
                <strong className="text-sm font-medium">{d.expiring} lotes para revisar</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vencidos ou vencem em até 30 dias
                </p>
              </div>
              <ArrowRight size={16} className="text-[#9675a2]" />
            </Link>
            <Link
              href={`/vendas?month=${month}`}
              className="flex items-center gap-3 rounded-lg bg-[#f0f3f8] p-4"
            >
              <span className="rounded-lg bg-white p-2 text-[#6a83a2]">
                <Wallet size={18} />
              </span>
              <div className="flex-1">
                <strong className="sensitive text-sm font-medium">
                  {money(d.receivables)} a receber
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">Das vendas deste mês</p>
              </div>
              <ArrowRight size={16} className="text-[#6a83a2]" />
            </Link>
          </div>
        </section>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <h2>Últimas vendas</h2>
              <p>Os movimentos mais recentes do mês</p>
            </div>
            <Link
              href={`/vendas?month=${month}`}
              className="flex items-center gap-2 text-xs font-medium text-primary"
            >
              Ver todas
              <ArrowRight size={14} />
            </Link>
          </div>
          <SalesTable rows={d.recent} compact />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Estoque por universo</h2>
              <p>Distribuição das unidades disponíveis</p>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="mb-6 flex h-4 overflow-hidden rounded-full">
              {d.mix.map((m, i) => (
                <span
                  key={m.label}
                  style={{
                    width: `${(m.quantity / stockTotal) * 100}%`,
                    background: ["#a34364", "#d3a87c", "#7c8da7"][i],
                  }}
                />
              ))}
            </div>
            <div className="space-y-5">
              {d.mix.map((m, i) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: ["#a34364", "#d3a87c", "#7c8da7"][i] }}
                  />
                  <span className="flex-1 text-sm">{m.label}</span>
                  <strong className="text-sm font-medium">{m.quantity}</strong>
                  <span className="w-9 text-right text-xs text-muted-foreground">
                    {Math.round((m.quantity / stockTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-7 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
              {d.customers} clientes ativos no seu relacionamento.
              <Link
                href="/clientes"
                className="mt-3 flex items-center gap-2 font-medium text-primary"
              >
                Ir para clientes
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
