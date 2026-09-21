import { payments } from "@/lib/domain";
import type { SaleView } from "@/lib/view-models";
import { money, dateLabel } from "@/lib/utils";
import { Empty } from "./common";
import { SaleActions } from "./forms";
export function SalesTable({
  rows,
  admin = false,
  compact = false,
}: {
  rows: SaleView[];
  admin?: boolean;
  compact?: boolean;
}) {
  if (!rows.length)
    return (
      <Empty
        title="Nenhuma venda neste período"
        description="Registre uma venda para começar a acompanhar os resultados."
      />
    );
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Venda / cliente</th>
            <th>Data</th>
            <th>Pagamento</th>
            <th>Status</th>
            <th className="text-right">Valor</th>
            {!compact && (
              <th>
                <span className="sr-only">Ações</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <span className="font-medium">{s.customer}</span>
                <div className="sub">
                  #{String(s.number).padStart(4, "0")}
                  {!compact && (
                    <details className="mt-2 max-w-xs">
                      <summary className="cursor-pointer">Ver itens</summary>
                      <p className="mt-2 leading-relaxed">{s.items}</p>
                    </details>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap text-muted-foreground">{dateLabel(s.createdAt)}</td>
              <td>{payments[s.paymentMethod]}</td>
              <td>
                <span
                  className={`badge ${s.status === "CANCELLED" ? "badge-red" : s.paymentStatus === "PAID" ? "badge-green" : "badge-amber"}`}
                >
                  {s.status === "CANCELLED"
                    ? "Cancelada"
                    : s.paymentStatus === "PAID"
                      ? "Recebida"
                      : "A receber"}
                </span>
              </td>
              <td className="sensitive whitespace-nowrap text-right font-medium">
                {money(s.totalCents)}
              </td>
              {!compact && (
                <td>
                  <SaleActions sale={s} admin={admin} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
