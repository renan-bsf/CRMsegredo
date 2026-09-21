import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/fields";
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
export function Empty({
  title = "Nenhum registro encontrado",
  description = "Os registros aparecerão aqui depois do primeiro cadastro.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <div className="mx-auto mb-4 w-fit rounded-full bg-muted p-3">
        <Search size={22} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
export function SearchForm({
  q,
  children,
  placeholder = "Buscar...",
}: {
  q: string;
  children?: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <form className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <Search size={17} className="absolute left-3 top-3 text-muted-foreground" />
        <Input
          name="q"
          aria-label={placeholder}
          defaultValue={q}
          placeholder={placeholder}
          className="pl-9"
          maxLength={100}
        />
      </div>
      {children}
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
export function MonthPicker({ month }: { month: string }) {
  return (
    <form className="flex gap-2">
      <Input
        aria-label="Mês de referência"
        name="month"
        type="month"
        defaultValue={month}
        min="2020-01"
        max="2100-12"
        className="w-44"
      />
      <Button variant="outline" type="submit">
        Aplicar
      </Button>
    </form>
  );
}
export function Pagination({
  page,
  total,
  base,
  params = {},
}: {
  page: number;
  total: number;
  base: string;
  params?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / 50));
  const link = (p: number) => `${base}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm text-muted-foreground">
      <span>
        {total} registro{total !== 1 ? "s" : ""} · página {page} de {pages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Button asChild variant="outline" size="sm">
            <Link href={link(page - 1)}>
              <ArrowLeft />
              Anterior
            </Link>
          </Button>
        )}
        {page < pages && (
          <Button asChild variant="outline" size="sm">
            <Link href={link(page + 1)}>
              Próxima
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
