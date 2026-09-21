import Link from "next/link";
import { notFound } from "next/navigation";
import { getPurchase } from "@/lib/server/purchase-queries";
import { purchaseKinds, purchaseStatuses } from "@/lib/purchasing";
import { money } from "@/lib/utils";
import { businessDate } from "@/lib/domain";
import { PageHeading } from "@/components/common";
import { Button } from "@/components/ui/button";
import { PurchaseControls } from "@/components/purchase-controls";
const date = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10).split("-").reverse().join("/") : "—";
export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getPurchase(id);
  if (!doc) notFound();
  return (
    <>
      <PageHeading
        eyebrow={purchaseKinds[doc.kind].toUpperCase()}
        title={doc.number + (doc.series ? " / " + doc.series : "")}
        description={doc.supplierName}
      >
        <Button asChild variant="outline">
          <Link href="/compras">Todos os documentos</Link>
        </Button>
      </PageHeading>
      <section className="panel mb-6 grid gap-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Fornecedor", doc.supplierName],
            ["CNPJ", doc.supplierTaxId],
            ["Emissão", date(doc.issuedAt)],
            ["Previsão de entrega", date(doc.expectedAt)],
            ["Situação", purchaseStatuses[doc.status]],
            [
              "Recebimento",
              doc.receivedAt ? businessDate(doc.receivedAt).split("-").reverse().join("/") : "—",
            ],
            ["Total dos produtos", money(doc.totalCents)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={
                  "mt-1 text-sm font-medium " + (label === "Total dos produtos" ? "sensitive" : "")
                }
              >
                {value}
              </p>
            </div>
          ))}
        </div>
        {doc.accessKey && (
          <div>
            <p className="text-xs text-muted-foreground">Chave da NF-e</p>
            <p className="mt-1 break-all font-mono text-sm">{doc.accessKey}</p>
          </div>
        )}
        {doc.sourceOrder && (
          <Link className="text-sm text-primary underline" href={"/compras/" + doc.sourceOrder.id}>
            Ver pedido de origem: {doc.sourceOrder.number}
          </Link>
        )}
        {doc.notes && <p className="whitespace-pre-wrap break-words text-sm">{doc.notes}</p>}
        {doc.status === "CANCELLED" && (
          <p className="rounded-lg bg-rose-50 p-4 text-sm">
            Cancelado em{" "}
            {doc.cancelledAt ? businessDate(doc.cancelledAt).split("-").reverse().join("/") : "—"}:{" "}
            {doc.cancelReason}
          </p>
        )}
        {doc.status === "REGISTERED" && (
          <PurchaseControls id={doc.id} invoice={doc.kind === "INVOICE"} />
        )}
        {doc.kind === "ORDER" && doc.status !== "CANCELLED" && (
          <Button asChild variant="outline">
            <Link href={"/compras/nova?pedido=" + doc.id}>Registrar nota deste pedido</Link>
          </Button>
        )}
      </section>
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <h2>Itens registrados</h2>
            <p>Custos e quantidades do documento</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Quantidade</th>
                <th>Custo unitário</th>
                <th>Total</th>
                <th>Lote</th>
                <th>Validade</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item) => (
                <tr key={item.id}>
                  <td className="min-w-48">{item.description}</td>
                  <td>{item.quantity}</td>
                  <td className="sensitive whitespace-nowrap">{money(item.unitCostCents)}</td>
                  <td className="sensitive whitespace-nowrap">
                    {money(item.quantity * item.unitCostCents)}
                  </td>
                  <td>{item.lotCode || "—"}</td>
                  <td className="whitespace-nowrap">{date(item.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {doc.invoices.length > 0 && (
        <section className="panel mt-6 p-6">
          <h2 className="mb-4 font-semibold">Notas vinculadas ao pedido</h2>
          <ul className="grid gap-3">
            {doc.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link className="text-sm text-primary underline" href={"/compras/" + invoice.id}>
                  Nota {invoice.number} · {purchaseStatuses[invoice.status]}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            O vínculo permite acompanhar faturamentos parciais. Confira as quantidades e os totais
            em cada nota.
          </p>
        </section>
      )}
    </>
  );
}
