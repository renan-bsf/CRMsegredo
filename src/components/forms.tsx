"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  PackagePlus,
  LoaderCircle,
  UserRound,
  SlidersHorizontal,
} from "lucide-react";
import {
  saveCustomer,
  saveProduct,
  receiveStock,
  saveExpense,
  adjustStock,
  cancelSale,
  markSalePaid,
  archiveCustomer,
  readCustomer,
  updateVariant,
  voidExpense,
  updateMember,
} from "@/app/actions";
import { categories, productTypes, businessDate, type ActionResult } from "@/lib/domain";
import type { CustomerView, SaleView, VariantView } from "@/lib/view-models";
import { money } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Field, Input, Select, Textarea } from "./ui/fields";

function str(form: FormData, key: string) {
  return String(form.get(key) ?? "");
}
function num(form: FormData, key: string) {
  return Number(str(form, key));
}
function price(form: FormData, key: string) {
  return Math.round(Number(str(form, key).replace(",", ".")) * 100);
}
function MoneyField({
  label,
  name,
  defaultValue = 0,
  min = 0,
}: {
  label: string;
  name: string;
  defaultValue?: number;
  min?: number;
}) {
  return (
    <Field label={label}>
      <Input
        name={name}
        type="number"
        step="0.01"
        min={min}
        max="1000000"
        defaultValue={(defaultValue / 100).toFixed(2)}
        required
      />
    </Field>
  );
}
function MutationDialog({
  title,
  description,
  trigger,
  children,
  onSubmit,
  submitLabel = "Salvar",
}: {
  title: string;
  description: string;
  trigger: React.ReactNode;
  children: React.ReactNode;
  onSubmit: (form: FormData) => Promise<ActionResult>;
  submitLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ActionResult>({ ok: false, message: "" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        const result = await onSubmit(form);
        setStatus(result);
        if (result.ok) {
          setOpen(false);
          router.refresh();
        }
      } catch {
        setStatus({
          ok: false,
          message: "A conexão falhou. Atualize a página antes de tentar novamente.",
        });
      }
    });
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) {
            setOpen(v);
            if (v) setStatus({ ok: false, message: "" });
          }
        }}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogTitle className="pr-8 text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="mb-6 mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
          <form action={submit} className="grid gap-4">
            <fieldset disabled={pending} className="grid min-w-0 gap-4">
              {children}
            </fieldset>
            {status.message && !status.ok && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-destructive">
                {status.message}
              </p>
            )}
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? (
                <>
                  <LoaderCircle className="animate-spin" />
                  Salvando...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {status.ok && (
        <p role="status" className="mt-2 max-w-sm text-xs text-emerald-700">
          {status.message}
        </p>
      )}
    </>
  );
}

export function ProductForm({ existing }: { existing?: VariantView }) {
  const [type, setType] = useState(existing?.type ?? "SET");
  return (
    <MutationDialog
      title={existing ? "Adicionar variação" : "Novo produto"}
      description="Cada combinação de tamanho e cor tem seu próprio SKU e estoque."
      trigger={
        <Button variant={existing ? "outline" : "default"} size={existing ? "sm" : "default"}>
          <Plus />
          {existing ? "Variação" : "Novo produto"}
        </Button>
      }
      onSubmit={(f) =>
        saveProduct({
          productId: existing?.productId,
          name: existing?.name ?? str(f, "name"),
          category: existing?.category ?? str(f, "category"),
          type: existing?.type ?? str(f, "type"),
          sku: str(f, "sku"),
          color: str(f, "color"),
          size: str(f, "size"),
          braBand: str(f, "braBand") ? num(f, "braBand") : null,
          braCup: str(f, "braCup"),
          bottomSize: str(f, "bottomSize"),
          power: str(f, "power"),
          priceCents: price(f, "price"),
          minStock: num(f, "minStock"),
        })
      }
    >
      <Field label="Nome do produto">
        <Input
          name="name"
          maxLength={120}
          minLength={2}
          required
          defaultValue={existing?.name}
          readOnly={Boolean(existing)}
          placeholder="Ex.: Conjunto Aurora"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Universo">
          <Select
            name="category"
            defaultValue={existing?.category ?? "LINGERIE"}
            disabled={Boolean(existing)}
          >
            {Object.entries(categories).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            disabled={Boolean(existing)}
          >
            {Object.entries(productTypes).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="SKU único">
        <Input
          name="sku"
          required
          minLength={2}
          maxLength={50}
          pattern="[A-Za-z0-9_.\-]+"
          placeholder="AUR-40B-ROS"
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Cor / acabamento">
          <Input name="color" required maxLength={50} placeholder="Rosa antigo" />
        </Field>
        <Field label="Tamanho / volume">
          <Input name="size" required maxLength={30} placeholder="40B / M, 100 ml..." />
        </Field>
      </div>
      {["SET", "TOP"].includes(type) && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tórax (opcional)">
            <Input name="braBand" type="number" min={28} max={70} />
          </Field>
          <Field label="Taça (opcional)">
            <Input name="braCup" maxLength={3} placeholder="B" />
          </Field>
        </div>
      )}
      {["SET", "BOTTOM"].includes(type) && (
        <Field label="Tamanho da peça inferior">
          <Input name="bottomSize" maxLength={20} placeholder="M" />
        </Field>
      )}
      {type === "ELECTRONIC" && (
        <Field label="Alimentação / voltagem">
          <Input name="power" required maxLength={60} placeholder="Bateria recarregável USB 5V" />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <MoneyField
          label="Preço de venda (R$)"
          name="price"
          min={0.01}
          defaultValue={existing?.priceCents}
        />
        <Field label="Estoque mínimo">
          <Input name="minStock" type="number" min={0} max={10000} defaultValue={3} required />
        </Field>
      </div>
    </MutationDialog>
  );
}
export function ReceiptForm({
  variants,
  selected,
}: {
  variants: VariantView[];
  selected?: string;
}) {
  return (
    <MutationDialog
      title="Entrada de estoque"
      description="Registre o lote recebido. O custo permanece visível apenas aos sócios."
      trigger={
        <Button variant="outline" size={selected ? "sm" : "default"}>
          <PackagePlus />
          Entrada de estoque
        </Button>
      }
      submitLabel="Registrar entrada"
      onSubmit={(f) =>
        receiveStock({
          variantId: str(f, "variantId"),
          code: str(f, "code"),
          quantity: num(f, "quantity"),
          unitCostCents: price(f, "cost"),
          expiresAt: str(f, "expiresAt"),
        })
      }
    >
      <Field label="Produto / variação">
        <Select name="variantId" defaultValue={selected} required>
          <option value="">Selecione a variação</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.sku}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Código do lote">
        <Input name="code" required maxLength={60} placeholder="Ex.: AUR-2026-09" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantidade">
          <Input name="quantity" type="number" min={1} max={10000} defaultValue={1} required />
        </Field>
        <MoneyField name="cost" label="Custo unitário (R$)" />
      </div>
      <Field
        label="Validade"
        hint="Obrigatória para cosméticos. Válido até o fim do dia informado."
      >
        <Input name="expiresAt" type="date" min={businessDate()} />
      </Field>
    </MutationDialog>
  );
}
export function VariantDetails({ variant, admin }: { variant: VariantView; admin: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Detalhes de ${variant.name} ${variant.sku}`}>
          <SlidersHorizontal />
          Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">{variant.name}</DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground">
          {variant.sku} · {variant.color} · {variant.size}
        </DialogDescription>
        <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
          <p>
            Disponível: <strong>{variant.available}</strong>
          </p>
          <p>
            Físico: <strong>{variant.stock}</strong>
          </p>
          {variant.power && <p className="col-span-2">Alimentação: {variant.power}</p>}
          {variant.braBand && (
            <p>
              Tórax / taça: {variant.braBand}
              {variant.braCup}
            </p>
          )}
          {variant.bottomSize && <p>Peça inferior: {variant.bottomSize}</p>}
        </div>
        <h3 className="mb-3 text-sm font-semibold">Lotes</h3>
        {variant.batches.length ? (
          <div className="space-y-3">
            {variant.batches.map((b) => (
              <div className="rounded-lg border p-3 text-sm" key={b.id}>
                <div className="flex justify-between">
                  <strong>{b.code}</strong>
                  <span>{b.quantity} un.</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Validade:{" "}
                  {b.expiresAt ? b.expiresAt.split("-").reverse().join("/") : "Não se aplica"}
                  {b.unitCostCents !== undefined && (
                    <>
                      {" "}
                      · Custo: <span className="sensitive">{money(b.unitCostCents)}</span>
                    </>
                  )}
                </p>
                {admin && (
                  <div className="mt-3">
                    <MutationDialog
                      title="Ajustar lote"
                      description="Informe a diferença de unidades e o motivo. O movimento ficará registrado."
                      trigger={
                        <Button variant="outline" size="sm">
                          Ajustar
                        </Button>
                      }
                      onSubmit={(f) =>
                        adjustStock({
                          batchId: b.id,
                          delta: num(f, "delta"),
                          reason: str(f, "reason"),
                        })
                      }
                    >
                      <Field
                        label="Diferença de unidades"
                        hint="Use um valor negativo para perdas, por exemplo -2."
                      >
                        <Input name="delta" type="number" min={-10000} max={10000} required />
                      </Field>
                      <Field label="Motivo">
                        <Input name="reason" required minLength={8} maxLength={160} />
                      </Field>
                    </MutationDialog>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum lote recebido.</p>
        )}
        {admin && (
          <div className="mt-6 flex flex-wrap gap-3">
            <ReceiptForm variants={[variant]} selected={variant.id} />
            <ProductForm existing={variant} />
            <MutationDialog
              title="Editar variação"
              description="Mudanças no preço não alteram vendas já registradas."
              trigger={
                <Button variant="outline" size="sm">
                  <Pencil />
                  Editar
                </Button>
              }
              onSubmit={(f) =>
                updateVariant({
                  id: variant.id,
                  priceCents: price(f, "price"),
                  minStock: num(f, "minStock"),
                  active: f.get("active") === "on",
                })
              }
            >
              <MoneyField
                label="Preço (R$)"
                name="price"
                min={0.01}
                defaultValue={variant.priceCents}
              />
              <Field label="Estoque mínimo">
                <Input
                  name="minStock"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={variant.minStock}
                  required
                />
              </Field>
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked />
                Variação ativa para venda
              </label>
            </MutationDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Profile = {
  id?: string;
  name: string;
  phone: string;
  braSize: string;
  bottomSize: string;
  notes: string;
  consent: boolean;
};
function CustomerFields({ data }: { data?: Profile }) {
  const [consent, setConsent] = useState(data?.consent ?? false);
  return (
    <>
      <Field label="Nome de atendimento">
        <Input
          name="name"
          defaultValue={data?.name}
          required
          minLength={2}
          maxLength={100}
          placeholder="Nome ou nome social"
        />
      </Field>
      <Field label="Telefone (opcional)">
        <Input
          name="phone"
          type="tel"
          defaultValue={data?.phone}
          maxLength={25}
          autoComplete="off"
        />
      </Field>
      <label className="flex items-start gap-3 rounded-lg bg-muted p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          name="consent"
          className="mt-1"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        A cliente autorizou o registro de medidas e preferências para o atendimento.
      </label>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tamanho de sutiã">
          <Input
            name="braSize"
            defaultValue={data?.braSize}
            maxLength={20}
            disabled={!consent}
            placeholder="40B"
          />
        </Field>
        <Field label="Peça inferior">
          <Input
            name="bottomSize"
            defaultValue={data?.bottomSize}
            maxLength={20}
            disabled={!consent}
            placeholder="M"
          />
        </Field>
      </div>
      <Field
        label="Preferências de atendimento"
        hint="Registre apenas o necessário. Ao retirar a autorização e salvar, medidas e preferências serão removidas."
      >
        <Textarea
          name="notes"
          defaultValue={data?.notes}
          maxLength={1500}
          disabled={!consent}
          placeholder="Cores, modelos e preferências informadas pela cliente"
        />
      </Field>
    </>
  );
}
function customerPayload(f: FormData, id?: string) {
  return {
    id,
    name: str(f, "name"),
    phone: str(f, "phone"),
    consent: f.get("consent") === "on",
    braSize: str(f, "braSize"),
    bottomSize: str(f, "bottomSize"),
    notes: str(f, "notes"),
  };
}
export function CustomerForm() {
  return (
    <MutationDialog
      title="Nova cliente"
      description="O cadastro pode usar somente o nome de atendimento. Contatos e preferências são protegidos."
      trigger={
        <Button>
          <Plus />
          Nova cliente
        </Button>
      }
      onSubmit={(f) => saveCustomer(customerPayload(f))}
    >
      <CustomerFields />
    </MutationDialog>
  );
}
export function CustomerDetails({ customer, admin }: { customer: CustomerView; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Profile>();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function load() {
    setOpen(true);
    setData(undefined);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await readCustomer(customer.id);
        setData(result.data);
        setMessage(result.error ?? "");
      } catch {
        setMessage("Não foi possível abrir o perfil.");
      }
    });
  }
  function submit(form: FormData) {
    startTransition(async () => {
      try {
        const result = await saveCustomer(customerPayload(form, customer.id));
        setMessage(result.message);
        if (result.ok) {
          setOpen(false);
          router.refresh();
        }
      } catch {
        setMessage("Não foi possível salvar. Tente novamente.");
      }
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!pending) {
          setOpen(v);
          if (!v) setData(undefined);
        }
      }}
    >
      <Button variant="ghost" size="sm" onClick={load}>
        <UserRound />
        Abrir perfil
      </Button>
      <DialogContent>
        <DialogTitle className="text-xl font-semibold">Perfil da cliente</DialogTitle>
        <DialogDescription className="mb-6 mt-2 text-sm text-muted-foreground">
          A consulta de contatos e preferências é registrada no histórico de acesso.
        </DialogDescription>
        {!data && pending && <p role="status">Carregando perfil...</p>}
        {data && (
          <form action={submit} className="grid gap-4">
            <fieldset disabled={pending} className="grid gap-4">
              <CustomerFields data={data} />
            </fieldset>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </form>
        )}
        {message && (
          <p role="status" className="mt-3 text-sm text-muted-foreground">
            {message}
          </p>
        )}
        {admin && data && (
          <div className="mt-5 border-t pt-4">
            <MutationDialog
              title="Arquivar cliente"
              description="A cliente sairá da lista ativa. As vendas e o histórico serão preservados."
              trigger={
                <Button variant="outline" size="sm">
                  Arquivar cadastro
                </Button>
              }
              submitLabel="Confirmar arquivamento"
              onSubmit={() => archiveCustomer(customer.id)}
            >
              <p className="text-sm font-medium">{customer.name}</p>
            </MutationDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ExpenseForm() {
  return (
    <MutationDialog
      title="Novo lançamento"
      description="Registre uma despesa ou pró-labore efetivamente ocorrido. Valores entram no resultado do mês informado."
      trigger={
        <Button>
          <Plus />
          Novo lançamento
        </Button>
      }
      onSubmit={(f) =>
        saveExpense({
          description: str(f, "description"),
          type: str(f, "type"),
          amountCents: price(f, "amount"),
          occurredAt: str(f, "occurredAt"),
        })
      }
    >
      <Field label="Descrição">
        <Input
          name="description"
          required
          minLength={3}
          maxLength={160}
          placeholder="Ex.: Embalagens, aluguel, pró-labore..."
        />
      </Field>
      <Field label="Categoria">
        <Select name="type">
          <option value="OPERATING">Despesa operacional</option>
          <option value="PRO_LABORE">Pró-labore</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <MoneyField label="Valor (R$)" name="amount" min={0.01} />
        <Field label="Data de ocorrência">
          <Input name="occurredAt" type="date" defaultValue={businessDate()} required />
        </Field>
      </div>
    </MutationDialog>
  );
}
export function VoidExpenseButton({ id }: { id: string }) {
  return (
    <MutationDialog
      title="Anular lançamento"
      description="O valor será retirado do resultado. O registro continuará na trilha de auditoria."
      trigger={
        <Button size="sm" variant="ghost">
          Anular
        </Button>
      }
      submitLabel="Confirmar anulação"
      onSubmit={() => voidExpense(id)}
    >
      <p className="text-sm">Use esta ação para corrigir um lançamento incorreto.</p>
    </MutationDialog>
  );
}
export function SaleActions({ sale, admin }: { sale: SaleView; admin: boolean }) {
  if (sale.status === "CANCELLED")
    return <span className="text-xs text-muted-foreground">Encerrada</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {sale.paymentStatus === "PENDING" && (
        <MutationDialog
          title="Confirmar recebimento"
          description="Use esta ação depois de conferir o recebimento fora do sistema."
          trigger={
            <Button variant="outline" size="sm">
              Receber
            </Button>
          }
          submitLabel="Confirmar recebimento"
          onSubmit={() => markSalePaid(sale.id)}
        >
          <p className="sensitive text-lg font-semibold">{money(sale.totalCents)}</p>
        </MutationDialog>
      )}
      {admin && (
        <MutationDialog
          title={`Cancelar venda #${sale.number}`}
          description="Os itens retornarão aos lotes de origem. Uma eventual devolução do pagamento deve ser feita e conferida fora do sistema."
          trigger={
            <Button variant="ghost" size="sm">
              Cancelar
            </Button>
          }
          submitLabel="Confirmar cancelamento"
          onSubmit={() => cancelSale(sale.id)}
        >
          <p className="text-sm">Confira a devolução física dos itens antes de continuar.</p>
        </MutationDialog>
      )}
    </div>
  );
}
export function MemberEditor({
  id,
  name,
  role,
  active,
  self,
}: {
  id: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
  self: boolean;
}) {
  if (self) return <span className="text-xs text-muted-foreground">Seu acesso</span>;
  return (
    <MutationDialog
      title={`Acesso de ${name}`}
      description="As permissões são verificadas a cada acesso e operação."
      trigger={
        <Button variant="outline" size="sm">
          Editar acesso
        </Button>
      }
      onSubmit={(f) => updateMember({ id, role: str(f, "role"), active: f.get("active") === "on" })}
    >
      <Field label="Perfil">
        <Select name="role" defaultValue={role}>
          <option value="ADMIN">Sócio administrador</option>
          <option value="OPERATOR">Operador</option>
        </Select>
      </Field>
      <label className="flex gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={active} />
        Acesso ativo
      </label>
    </MutationDialog>
  );
}
