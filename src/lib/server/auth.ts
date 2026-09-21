import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabase } from "./supabase";
import { isConfigured, isDemo } from "./config";
import { db } from "./db";
import { can, type Actor } from "@/lib/domain";

const loadActor = cache(async (): Promise<{ actor: Actor; aal: string | undefined }> => {
  if (isDemo())
    return {
      actor: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Sócia demonstração",
        role: "ADMIN",
        demo: true,
      },
      aal: "aal2",
    };
  if (!isConfigured()) redirect("/login");
  const client = await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: verified, error: claimsError } = await client.auth.getClaims();
  const claims = verified?.claims;
  if (claimsError || !claims || claims.sub !== user.id || typeof claims.session_id !== "string")
    redirect("/login");
  const member = await db().member.findUnique({ where: { id: user.id } });
  if (!member?.active) redirect("/login?blocked=1");
  // Valida revogação da sessão no banco; um JWT ainda não expirado não basta.
  const sessions = await db().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${user.id}, true)`;
    return tx.$queryRaw<{ valid: boolean }[]>`
      SELECT private.session_is_active(
        ${claims.session_id}::uuid,
        ${user.id}::uuid
      ) AS valid`;
  });
  if (!sessions[0]?.valid) redirect("/login");
  return {
    actor: { id: member.id, name: member.name, role: member.role, demo: false },
    aal: typeof claims.aal === "string" ? claims.aal : undefined,
  };
});

export async function requireActor(
  permission: "operate" | "manage" = "operate",
  allowMfaSetup = false,
): Promise<Actor> {
  const { actor, aal } = await loadActor();
  if (!allowMfaSetup && aal !== "aal2") redirect("/seguranca");
  if (!can(actor.role, permission)) redirect("/?denied=1");
  return actor;
}
