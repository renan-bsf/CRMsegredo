"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ShoppingBag, Check, LoaderCircle } from "lucide-react";
import { createSale } from "@/app/actions";
import { findSaleProducts, findSaleCustomers } from "@/app/lookup-actions";
import { payments, type ActionResult } from "@/lib/domain";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/fields";
type ProductOption = Awaited<ReturnType<typeof findSaleProducts>>[number];
export function SaleComposer({
  products: initial,
  customers: initialCustomers,
  demo,
}: {
  products: ProductOption[];
  customers: { id: string; name: string }[];
  demo: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initial);
  const [customers, setCustomers] = useState(initialCustomers);
  const [q, setQ] = useState("");
  const [customerQ, setCustomerQ] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<{ product: ProductOption; quantity: number }[]>([]);
  const [discount, setDiscount] = useState("0.00");
  const [method, setMethod] = useState<keyof typeof payments>("PIX");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "PENDING">("PAID");
  const [idempotencyKey, setIdempotencyKey] = useState<string>();
  const [result, setResult] = useState<ActionResult>({ ok: false, message: "" });
  const [saving, startSave] = useTransition();
  const [searching, startSearch] = useTransition();
  const [searchingCustomer, startCustomerSearch] = useTransition();
  const subtotal = items.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);
  const discountCents = Math.round(Number(discount) * 100);
  const total = subtotal - discountCents;
  const canSave =
    items.length > 0 &&
    Number.isSafeInteger(total) &&
    total >= 0 &&
    discountCents >= 0 &&
    items.every(
      (i) =>
        i.quantity > 0 &&
        Number.isInteger(i.quantity) &&
        i.quantity <= Math.min(1000, i.product.available),
    ) &&
    (paymentStatus === "PAID" || Boolean(customerId));
  function changed() {
    setIdempotencyKey(undefined);
    setResult({ ok: false, message: "" });
  }
  function add(product: ProductOption) {
    changed();
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing)
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(product.available, 1000, i.quantity + 1) }
            : i,
        );
      return prev.length < 30 ? [...prev, { product, quantity: 1 }] : prev;
    });
  }
  function searchProducts() {
    startSearch(async () => {
      try {
        setProducts(await findSaleProducts(q));
      } catch {
        setResult({ ok: false, message: "Não foi possível buscar os produtos." });
      }
    });
  }
  function searchCustomers() {
    startCustomerSearch(async () => {
      try {
        const found = await findSaleCustomers(customerQ);
        setCustomers(found);
        if (!found.some((c) => c.id === customerId)) {
          setCustomerId("");
          changed();
        }
      } catch {
        setResult({ ok: false, message: "Não foi possível buscar clientes." });
      }
    });
  }
  function save() {
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    startSave(async () => {
      try {
        const response = await createSale({
          idempotencyKey: key,
          customerId: customerId || null,
          paymentMethod: method,
          paymentStatus,
          discountCents,
          items: items.map((i) => ({ variantId: i.product.id, quantity: i.quantity })),
        });
        setResult(response);
        if (response.ok) {
          router.push("/vendas");
          router.refresh();
        }
      } catch {
        setResult({
          ok: false,
          message:
            "Conexão interrompida. Tente novamente sem alterar a venda; a chave evita duplicação.",
        });
      }
    });
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>1. Escolha os produtos</h2>
            <p>Busque pelo nome ou SKU</p>
          </div>
        </div>
        <form
          className="flex gap-2 px-6 pb-5"
          onSubmit={(e) => {
            e.preventDefault();
            searchProducts();
          }}
        >
          <Input
            aria-label="Buscar produto"
            placeholder="Buscar produto ou SKU"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
          />
          <Button type="submit" variant="outline" disabled={searching}>
            <Search />
            Buscar
          </Button>
        </form>
        <div className="max-h-[650px] overflow-auto border-t">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b px-6 py-4 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.sku} · {p.color} · {p.size}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{p.available} un. disponíveis</p>
              </div>
              <strong className="text-sm whitespace-nowrap">{money(p.priceCents)}</strong>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Adicionar ${p.name} ${p.sku}`}
                disabled={
                  !p.available ||
                  saving ||
                  (items.length >= 30 && !items.some((i) => i.product.id === p.id))
                }
                onClick={() => add(p)}
              >
                <Plus />
              </Button>
            </div>
          ))}
          {!products.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
        <p className="border-t px-6 py-3 text-xs text-muted-foreground">
          Até 50 resultados. Refine a busca para localizar uma variação.
        </p>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>2. Registre a venda</h2>
            <p>Confira itens, cliente e pagamento</p>
          </div>
          <ShoppingBag size={20} className="text-primary" />
        </div>
        <fieldset disabled={saving} className="grid min-w-0 gap-5 px-6 pb-6">
          <div className="grid gap-3">
            <div className="flex gap-2">
              <Input
                value={customerQ}
                onChange={(e) => setCustomerQ(e.target.value)}
                placeholder="Buscar cliente pelo nome"
                aria-label="Buscar cliente"
                maxLength={100}
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Buscar cliente"
                disabled={searchingCustomer}
                onClick={searchCustomers}
              >
                <Search />
              </Button>
            </div>
            <Field label="Cliente">
              <Select
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  changed();
                }}
              >
                <option value="">Venda avulsa (sem cadastro)</option>
                {customers.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="rounded-lg border">
            {!items.length ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Adicione produtos para começar.
              </p>
            ) : (
              items.map((i) => (
                <div className="grid gap-3 border-b p-4 last:border-0" key={i.product.id}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 text-sm">
                      <strong className="font-medium">{i.product.name}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {i.product.size} · {i.product.color}
                      </p>
                    </div>
                    <button
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Remover ${i.product.name}`}
                      onClick={() => {
                        setItems(items.filter((v) => v.product.id !== i.product.id));
                        changed();
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Input
                      className="w-20"
                      type="number"
                      min={1}
                      max={Math.min(1000, i.product.available)}
                      value={i.quantity}
                      aria-label={`Quantidade de ${i.product.name}`}
                      onChange={(e) => {
                        setItems(
                          items.map((v) =>
                            v.product.id === i.product.id
                              ? { ...v, quantity: Number(e.target.value) }
                              : v,
                          ),
                        );
                        changed();
                      }}
                    />
                    <span className="text-sm font-medium">
                      {money(i.product.priceCents * i.quantity)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pagamento">
              <Select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as keyof typeof payments);
                  changed();
                }}
              >
                {Object.entries(payments).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Situação">
              <Select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value as typeof paymentStatus);
                  changed();
                }}
              >
                <option value="PAID">Já recebido</option>
                <option value="PENDING">A receber</option>
              </Select>
            </Field>
          </div>
          {paymentStatus === "PENDING" && !customerId && (
            <p className="text-xs text-amber-800">
              Selecione uma cliente para registrar um valor a receber.
            </p>
          )}
          <Field label="Desconto total (R$)">
            <Input
              type="number"
              min={0}
              max={subtotal / 100}
              step="0.01"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                changed();
              }}
            />
          </Field>
          <div className="space-y-3 border-t pt-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Desconto</span>
              <span>− {money(Number.isFinite(discountCents) ? discountCents : 0)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{money(Number.isFinite(total) ? total : 0)}</span>
            </div>
          </div>
          {result.message && (
            <p
              role="alert"
              className={`rounded-lg p-3 text-sm ${result.ok ? "bg-green-50 text-green-800" : "bg-rose-50 text-destructive"}`}
            >
              {result.message}
            </p>
          )}
          <Button onClick={save} disabled={saving || !canSave} className="h-11">
            {saving ? <LoaderCircle className="animate-spin" /> : <Check />}
            {saving ? "Registrando..." : "Registrar venda"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {demo
              ? "Demonstração: a gravação desta venda está bloqueada."
              : "Ao registrar, o estoque será baixado. Confirme o pagamento somente após conferir o recebimento."}
          </p>
        </fieldset>
      </section>
    </div>
  );
}
