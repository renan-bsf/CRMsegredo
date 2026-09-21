"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { receiveInvoice, cancelPurchaseDocument } from "@/app/purchase-actions";
import { Button } from "./ui/button";
import { Field, Textarea } from "./ui/fields";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";
export function PurchaseControls({ id, invoice }: { id: string; invoice: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"receive" | "cancel" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function submit(form: FormData) {
    start(async () => {
      try {
        const result =
          mode === "receive"
            ? await receiveInvoice(id)
            : await cancelPurchaseDocument({ id, reason: form.get("reason") });
        setMessage(result.message);
        if (result.ok) {
          setMode(null);
          router.refresh();
        }
      } catch {
        setMessage(
          "Não foi possível concluir. Atualize a página para conferir o estado do documento.",
        );
      }
    });
  }
  return (
    <div className="grid gap-3">
      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setMode(null);
        }}
      >
        <div className="flex flex-wrap gap-3">
          {invoice && (
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setMode("receive");
                  setMessage("");
                }}
              >
                Confirmar recebimento
              </Button>
            </DialogTrigger>
          )}
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => {
                setMode("cancel");
                setMessage("");
              }}
            >
              Cancelar registro
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent>
          <DialogTitle className="text-xl font-semibold">
            {mode === "receive" ? "Receber mercadorias" : "Cancelar registro"}
          </DialogTitle>
          <DialogDescription className="my-4 text-sm text-muted-foreground">
            {mode === "receive"
              ? "Confirme após conferir todos os produtos, quantidades, lotes e custos. Esta operação adiciona os itens ao estoque uma única vez."
              : "O registro continuará no histórico. Notas já recebidas não podem ser canceladas por esta ação."}
          </DialogDescription>
          <form action={submit} className="grid gap-4">
            {mode === "cancel" && (
              <Field label="Motivo do cancelamento">
                <Textarea name="reason" required minLength={8} maxLength={300} disabled={pending} />
              </Field>
            )}
            {message && (
              <p role="status" className="text-sm">
                {message}
              </p>
            )}
            <Button disabled={pending} type="submit">
              {pending ? "Processando..." : "Confirmar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {mode === null && message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}
