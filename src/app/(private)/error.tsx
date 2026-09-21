"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="panel p-8">
      <h1 className="text-xl font-semibold">Não foi possível carregar esta página</h1>
      <p className="my-4 text-muted-foreground">
        Confira a conexão e tente novamente. Nenhum detalhe dos seus dados foi exibido.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
