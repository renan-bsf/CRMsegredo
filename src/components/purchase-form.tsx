"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Search } from "lucide-react";
import { savePurchase, findPurchaseProducts } from "@/app/purchase-actions";
import { businessDate } from "@/lib/domain";
import { purchaseKinds, type PurchaseInput } from "@/lib/purchasing";
import { money } from "@/lib/utils";
import { Field, Input, Select, Textarea } from "./ui/fields";
import { Button } from "./ui/button";

type Line = PurchaseInput["items"][number] & { key: string; label: string; cosmetic: boolean };
export type PurchasePrefill = {
  orderId: string;
  supplierName: string;
  supplierTaxId: string;
  items: Omit<Line, "key">[];
};
export function PurchaseForm({ prefill }: { prefill?: PurchasePrefill }) {
  const router = useRouter();
  const [kind, setKind] = useState<"ORDER" | "INVOICE">(prefill ? "INVOICE" : "ORDER");
  const [lines, setLines] = useState<Line[]>(
    () => prefill?.items.map((item, i) => ({ ...item, key: String(i) })) ?? [],
  );
  const [requestKey] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Awaited<ReturnType<typeof findPurchaseProducts>>>([]);
  const [searchMessage, setSearchMessage] = useState("");
  const [message, setMessage] = useState("");
  const [saving, startSave] = useTransition();
  const [searching, startSearch] = useTransition();
  function search() {
    startSearch(async () => {
      try {
        const rows = await findPurchaseProducts(query.trim());
        setProducts(rows);
        setSearchMessage(
          rows.length
            ? "Até 20 resultados. Refine a busca pelo SKU."
            : "Nenhum produto encontrado.",
        );
      } catch {
        setSearchMessage(
          "Não foi possível buscar. Informe ao menos 2 caracteres e tente novamente.",
        );
      }
    });
  }
  function update(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function submit(form: FormData) {
    setMessage("");
    startSave(async () => {
      try {
        const result = await savePurchase({
          idempotencyKey: requestKey,
          kind,
          supplierName: form.get("supplierName"),
          supplierTaxId: form.get("supplierTaxId"),
          number: form.get("number"),
          series: form.get("series") ?? "",
          accessKey: kind === "INVOICE" ? (form.get("accessKey") ?? "") : "",
          issuedAt: form.get("issuedAt"),
          expectedAt: form.get("expectedAt") ?? "",
          notes: form.get("notes") ?? "",
          sourceOrderId: prefill?.orderId ?? null,
          items: lines.map(({ variantId, quantity, unitCostCents, lotCode, expiresAt }) => ({
            variantId,
            quantity,
            unitCostCents,
            lotCode,
            expiresAt,
          })),
        });
        if (result.ok && result.documentId) {
          router.push("/compras/" + result.documentId);
          router.refresh();
        } else setMessage(result.message);
      } catch {
        setMessage(
          "Não foi possível salvar. Tente novamente; o mesmo envio não cria registros duplicados.",
        );
      }
    });
  }
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCostCents, 0);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(new FormData(event.currentTarget));
      }}
      className="grid gap-6"
    >
      <fieldset disabled={saving} className="panel grid min-w-0 gap-5 p-6">
        <h2 className="text-lg font-semibold">Documento e fornecedor</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de documento">
            <Select
              value={kind}
              disabled={!!prefill}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              {Object.entries(purchaseKinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fornecedor">
            <Input
              name="supplierName"
              defaultValue={prefill?.supplierName}
              required
              maxLength={160}
            />
          </Field>
          <Field label="CNPJ do fornecedor">
            <Input
              name="supplierTaxId"
              defaultValue={prefill?.supplierTaxId}
              placeholder="00.000.000/0000-00"
              required
              maxLength={18}
            />
          </Field>
          <Field label={kind === "ORDER" ? "Número do pedido" : "Número da nota fiscal"}>
            <Input name="number" required maxLength={40} />
          </Field>
          <Field label="Série (opcional)">
            <Input name="series" maxLength={10} />
          </Field>
          <Field label="Data de emissão">
            <Input type="date" name="issuedAt" defaultValue={businessDate()} required />
          </Field>
          <Field label="Previsão de entrega (opcional)">
            <Input type="date" name="expectedAt" />
          </Field>
          {kind === "INVOICE" && (
            <Field label="Chave da NF-e (opcional)" hint="44 dígitos, sem espaços.">
              <Input name="accessKey" inputMode="numeric" pattern="[0-9]{44}" maxLength={44} />
            </Field>
          )}
        </div>
        {prefill && (
          <p className="text-sm text-muted-foreground">
            Nota vinculada ao pedido de origem. Confira as quantidades efetivamente faturadas antes
            de salvar.
          </p>
        )}
        <Field label="Observações">
          <Textarea
            name="notes"
            maxLength={2000}
            placeholder="Condições da compra, transporte ou referência do documento original."
          />
        </Field>
      </fieldset>
      <fieldset disabled={saving} className="panel grid min-w-0 gap-5 p-6">
        <h2 className="text-lg font-semibold">Produtos do documento</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Buscar produto ou SKU">
            <Input
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="Ex.: sutiã ou SKU"
            />
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={searching || query.trim().length < 2}
            onClick={search}
          >
            <Search size={16} />
            {searching ? "Buscando..." : "Buscar"}
          </Button>
          <Link href="/estoque" className="text-sm text-primary underline">
            Cadastrar produto
          </Link>
        </div>
        {searchMessage && (
          <p role="status" className="text-sm text-muted-foreground">
            {searchMessage}
          </p>
        )}
        {products.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                <span className="text-sm">{p.label}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={lines.length >= 50}
                  onClick={() =>
                    setLines((current) => [
                      ...current,
                      {
                        key: crypto.randomUUID(),
                        variantId: p.id,
                        label: p.label,
                        cosmetic: p.cosmetic,
                        quantity: 1,
                        unitCostCents: 0,
                        lotCode: "",
                        expiresAt: "",
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  Adicionar
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!lines.length && (
          <p className="rounded-lg bg-muted p-5 text-sm text-muted-foreground">
            Busque e adicione os produtos. Cadastre as variações em Produtos e estoque se
            necessário.
          </p>
        )}
        {lines.map((line, index) => (
          <div key={line.key} className="grid min-w-0 gap-3 rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <strong className="text-sm">{line.label}</strong>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={"Remover " + line.label}
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Quantidade">
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  step={1}
                  required
                  value={line.quantity || ""}
                  onChange={(e) => update(index, { quantity: Number(e.target.value) })}
                />
              </Field>
              <Field label="Custo unitário (R$)">
                <Input
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="0.01"
                  required
                  defaultValue={line.unitCostCents ? (line.unitCostCents / 100).toFixed(2) : ""}
                  onChange={(e) =>
                    update(index, { unitCostCents: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </Field>
              <Field label={kind === "INVOICE" ? "Lote" : "Lote (opcional)"}>
                <Input
                  value={line.lotCode}
                  required={kind === "INVOICE"}
                  maxLength={60}
                  onChange={(e) => update(index, { lotCode: e.target.value })}
                />
              </Field>
              <Field
                label={"Validade" + (line.cosmetic && kind === "INVOICE" ? " *" : " (opcional)")}
              >
                <Input
                  type="date"
                  value={line.expiresAt}
                  required={line.cosmetic && kind === "INVOICE"}
                  onChange={(e) => update(index, { expiresAt: e.target.value })}
                />
              </Field>
            </div>
            <p className="sensitive text-right text-sm font-medium">
              {money(line.quantity * line.unitCostCents)}
            </p>
          </div>
        ))}
        <p className="sensitive text-right text-lg font-semibold">
          Total dos produtos: {money(total)}
        </p>
        <p className="text-sm text-muted-foreground">
          Informe os custos finais por unidade, incluindo o rateio de frete, tributos e descontos
          quando aplicável. Salvar o documento não movimenta o estoque; confirme o recebimento na
          tela da nota.
        </p>
      </fieldset>
      {message && (
        <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-destructive">
          {message}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <Button asChild variant="outline">
          <Link href="/compras">Voltar</Link>
        </Button>
        <Button disabled={saving || !lines.length} type="submit">
          {saving ? "Registrando..." : "Registrar documento"}
        </Button>
      </div>
    </form>
  );
}
