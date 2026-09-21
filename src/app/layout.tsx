import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Gestão Íntima · Segredo da Maria", template: "%s · Gestão Íntima" },
  description: "Espaço privado de gestão da Segredo da Maria.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
