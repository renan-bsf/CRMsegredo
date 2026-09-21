"use client";
/* eslint-disable @next/next/no-img-element -- QR TOTP é uma data URI privada, sem otimização ou cache de imagem. */
import { useActionState, useState, useTransition } from "react";
import { enrollMfa, verifyMfa } from "@/app/auth-actions";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/fields";
export function MfaForm({ verifiedFactors }: { verifiedFactors: { id: string; name: string }[] }) {
  const [factorId, setFactorId] = useState(verifiedFactors[0]?.id ?? "");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [state, action, verifying] = useActionState(verifyMfa, { ok: false, message: "" });
  function enroll() {
    startTransition(async () => {
      try {
        const result = await enrollMfa();
        setError(result.error ?? "");
        setQr(result.qr ?? "");
        setFactorId(result.factorId ?? "");
      } catch {
        setError("Não foi possível configurar. Tente novamente.");
      }
    });
  }
  return (
    <div className="mt-6 grid gap-5">
      {!factorId && (
        <Button disabled={pending} onClick={enroll}>
          {pending ? "Preparando..." : "Configurar autenticador"}
        </Button>
      )}
      {qr && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            Escaneie com seu aplicativo autenticador e confirme o código.
          </p>
          {/* QR emitido pelo Supabase para esta conta. */}
          <img
            src={qr}
            width={220}
            height={220}
            alt="QR code para configurar a autenticação em duas etapas"
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {factorId && (
        <form action={action} className="grid gap-4">
          {verifiedFactors.length > 1 ? (
            <select
              className="field"
              aria-label="Autenticador"
              name="factorId"
              value={factorId}
              onChange={(e) => setFactorId(e.target.value)}
            >
              {verifiedFactors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="factorId" value={factorId} />
          )}
          <Field label="Código do autenticador">
            <Input
              name="code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              placeholder="000000"
              required
            />
          </Field>
          {state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={verifying}>
            {verifying ? "Verificando..." : "Confirmar e entrar"}
          </Button>
        </form>
      )}
    </div>
  );
}
