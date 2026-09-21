"use client";
import { useActionState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { signIn } from "@/app/auth-actions";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/fields";
export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, { ok: false, message: "" });
  return (
    <form action={action} className="mt-8 grid gap-5">
      <Field label="E-mail">
        <Input
          type="email"
          name="email"
          autoComplete="username"
          placeholder="seu@email.com"
          required
          maxLength={254}
          disabled={!configured}
        />
      </Field>
      <Field label="Senha">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          required
          minLength={8}
          maxLength={128}
          disabled={!configured}
        />
      </Field>
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" className="mt-1 h-11" disabled={pending || !configured}>
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <>
            Entrar no meu espaço
            <ArrowRight />
          </>
        )}
      </Button>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Acesso disponível somente para usuários autorizados.
        <br />A confirmação em duas etapas será solicitada ao entrar.
      </p>
    </form>
  );
}
