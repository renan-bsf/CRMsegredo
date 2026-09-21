import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-12">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link className="mt-6 block text-primary underline" href="/">
        Voltar à visão geral
      </Link>
    </main>
  );
}
