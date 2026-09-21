import Link from "next/link";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import { isConfigured, isDemo } from "@/lib/server/config";
import { LoginForm } from "@/components/login-form";
import { Button } from "@/components/ui/button";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string }>;
}) {
  const { blocked } = await searchParams;
  const configured = isConfigured();
  return (
    <main className="auth-layout">
      <div className="auth-brand">
        <div className="brand">
          <span className="brand-mark">
            m<span>·</span>
          </span>
          <span>
            <strong>Segredo da Maria</strong>
            <small>GESTÃO ÍNTIMA</small>
          </span>
        </div>
        <div className="auth-story">
          <p className="mb-6 text-xs tracking-[.2em] text-rose-200">CUIDADO EM CADA DETALHE</p>
          <h1>Mais clareza para cuidar do que é de vocês.</h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-slate-300">
            Vendas, estoque, clientes e finanças.
            <br />
            Tudo no mesmo espaço, com a discrição que seu negócio merece.
          </p>
        </div>
        <div className="auth-story flex items-center gap-3 text-sm text-slate-300">
          <ShieldCheck size={19} />
          Gestão exclusiva dos sócios
        </div>
      </div>
      <div className="auth-content">
        <div className="w-full max-w-sm">
          <div className="mb-6 w-fit rounded-xl bg-[#f6eaf0] p-3 text-primary">
            <LockKeyhole size={24} />
          </div>
          <p className="eyebrow">BEM-VINDOS DE VOLTA</p>
          <h2 className="text-3xl font-semibold tracking-tight">Seu negócio em boas mãos.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Entre para acompanhar a sua operação.
          </p>
          {blocked && (
            <p role="alert" className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-destructive">
              Seu acesso não está ativo. Fale com um sócio administrador.
            </p>
          )}
          {!configured && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
              <strong>Conexão ainda não configurada</strong>
              <p className="mt-1">
                O responsável pela instalação precisa configurar o Supabase e cadastrar os sócios
                antes do primeiro acesso.
              </p>
            </div>
          )}
          <LoginForm configured={configured && !isDemo()} />
          {isDemo() && (
            <Button variant="outline" asChild className="mt-6 w-full">
              <Link href="/">Explorar demonstração local</Link>
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
