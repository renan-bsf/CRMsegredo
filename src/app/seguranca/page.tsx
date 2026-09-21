import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { requireActor } from "@/lib/server/auth";
import { supabase } from "@/lib/server/supabase";
import { MfaForm } from "@/components/mfa-form";
import { signOut } from "@/app/auth-actions";
export default async function SecurityPage() {
  const actor = await requireActor("operate", true);
  if (actor.demo) redirect("/");
  const client = await supabase();
  const { data: claims } = await client.auth.getClaims();
  if (claims?.claims.aal === "aal2") redirect("/");
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new Error("Não foi possível consultar os fatores de autenticação.");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="panel p-7">
        <ShieldCheck className="mb-5 text-primary" size={30} />
        <p className="eyebrow">SEGURANÇA DA CONTA</p>
        <h1 className="text-2xl font-semibold">Confirme que é você</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Use o código do seu aplicativo autenticador para acessar os dados do negócio.
        </p>
        <MfaForm
          verifiedFactors={(data?.totp ?? [])
            .filter((f) => f.status === "verified")
            .map((f) => ({ id: f.id, name: f.friendly_name ?? "Autenticador" }))}
        />
        <form action={signOut}>
          <button className="mt-5 text-sm text-muted-foreground underline">Sair desta conta</button>
        </form>
      </div>
    </main>
  );
}
