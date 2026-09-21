"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  ChartNoAxesCombined,
  Settings2,
  ShieldCheck,
  LogOut,
  Eye,
  EyeOff,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import type { Actor } from "@/lib/domain";
import { signOut } from "@/app/auth-actions";
import { cn } from "@/lib/utils";
const nav = [
  { href: "/", title: "Visão geral", icon: LayoutDashboard },
  { href: "/vendas", title: "Vendas", icon: ShoppingBag },
  { href: "/estoque", title: "Produtos e estoque", icon: Package },
  { href: "/clientes", title: "Clientes", icon: Users },
  { href: "/financeiro", title: "Financeiro", icon: ChartNoAxesCombined, admin: true },
  { href: "/configuracoes", title: "Configurações", icon: Settings2, admin: true },
];
export function Shell({ actor, children }: { actor: Actor; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [privateView, setPrivateView] = useState(false);
  const current = nav.find((n) => n.href === pathname);
  return (
    <div className={cn("app-shell", privateView && "privacy-mode")}>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={cn("sidebar", open && "sidebar-open")}>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">
            m<span>·</span>
          </span>
          <span>
            <strong>Segredo da Maria</strong>
            <small>GESTÃO ÍNTIMA</small>
          </span>
        </Link>
        <button
          className="absolute right-3 top-4 p-2 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">ESPAÇO DE GESTÃO</div>
        <nav aria-label="Navegação principal">
          {nav
            .filter((n) => !n.admin || actor.role === "ADMIN")
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={pathname === n.href ? "page" : undefined}
                className={cn("nav-item", pathname === n.href && "active")}
                onClick={() => setOpen(false)}
              >
                <n.icon size={19} strokeWidth={1.7} />
                {n.title}
                {pathname === n.href && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-rose-300" />
                )}
              </Link>
            ))}
        </nav>
        <div className="mt-auto">
          <div className="sidebar-note">
            <ShieldCheck size={20} />
            <div>
              <strong>{actor.demo ? "Ambiente de demonstração" : "Espaço privado"}</strong>
              <p>{actor.demo ? "Somente dados fictícios" : "Acesso exclusivo à sua equipe"}</p>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">{actor.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{actor.name}</strong>
              <small>{actor.role === "ADMIN" ? "Sócio administrador" : "Operador"}</small>
            </span>
            <form action={signOut}>
              <button title="Sair" aria-label="Sair" className="rounded p-2 hover:bg-white/10">
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <button
              className="rounded p-2 lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="hidden text-sm text-muted-foreground sm:inline">Meu negócio</span>
            <ChevronRight size={14} className="hidden text-muted-foreground sm:block" />
            <span className="text-sm font-medium">{current?.title ?? "Gestão"}</span>
          </div>
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "badge hidden sm:inline-flex",
                actor.demo ? "badge-amber" : "badge-green",
              )}
            >
              {actor.demo ? "Demonstração" : "Acesso privado"}
            </span>
            <button
              onClick={() => setPrivateView(!privateView)}
              className="rounded-lg p-2 hover:bg-muted"
              aria-label={privateView ? "Mostrar valores" : "Ocultar valores na tela"}
              title="Privacidade da tela"
            >
              {privateView ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
            <span className="top-avatar">{actor.name.slice(0, 1)}</span>
          </div>
        </header>
        {actor.demo && (
          <div className="demo-banner">
            Você está explorando dados fictícios. Os formulários não salvam alterações nesta
            demonstração.
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Segredo da Maria · Gestão Íntima</span>
          <span>Seu espaço de trabalho privado</span>
        </footer>
      </div>
    </div>
  );
}
