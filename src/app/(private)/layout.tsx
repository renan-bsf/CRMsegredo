import { requireActor } from "@/lib/server/auth";
import { Shell } from "@/components/shell";
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  return <Shell actor={actor}>{children}</Shell>;
}
