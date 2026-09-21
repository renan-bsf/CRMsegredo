"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isConfigured, isDemo } from "@/lib/server/config";
import { supabase } from "@/lib/server/supabase";
import { requireActor } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import type { ActionResult } from "@/lib/domain";

export async function signIn(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  if (!isConfigured() || isDemo())
    return { ok: false, message: "Configure a conexão com o Supabase para entrar." };
  const parsed = z
    .object({ email: z.string().email().max(254), password: z.string().min(8).max(128) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Confira o e-mail e a senha." };
  try {
    const client = await supabase();
    const { data, error } = await client.auth.signInWithPassword(parsed.data);
    if (error || !data.user)
      return {
        ok: false,
        message: "Acesso não autorizado. Confira as credenciais ou tente mais tarde.",
      };
    const member = await db().member.findUnique({
      where: { id: data.user.id },
      select: { active: true },
    });
    if (!member?.active) {
      await client.auth.signOut();
      return {
        ok: false,
        message: "Acesso não autorizado. Confira as credenciais ou tente mais tarde.",
      };
    }
  } catch {
    return { ok: false, message: "Não foi possível entrar. Tente novamente em instantes." };
  }
  revalidatePath("/", "layout");
  redirect("/seguranca");
}
export async function signOut() {
  if (!isDemo() && isConfigured()) {
    const client = await supabase();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
export async function enrollMfa(): Promise<{ qr?: string; factorId?: string; error?: string }> {
  const actor = await requireActor("operate", true);
  if (actor.demo) return { error: "A demonstração não configura contas reais." };
  const client = await supabase();
  const { data: factors, error: listError } = await client.auth.mfa.listFactors();
  if (listError) return { error: "Não foi possível consultar os fatores." };
  if (factors.totp.some((f) => f.status === "verified"))
    return { error: "Use o autenticador já cadastrado." };
  for (const factor of factors.all.filter(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  ))
    await client.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Gestão Íntima",
  });
  if (error || !data) return { error: "Não foi possível iniciar a configuração." };
  return { qr: data.totp.qr_code, factorId: data.id };
}
export async function verifyMfa(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requireActor("operate", true);
  if (actor.demo) return { ok: false, message: "Modo demonstração." };
  const parsed = z
    .object({ factorId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Informe os seis dígitos do autenticador." };
  const client = await supabase();
  const { error } = await client.auth.mfa.challengeAndVerify(parsed.data);
  if (error) return { ok: false, message: "Código inválido ou expirado. Tente novamente." };
  revalidatePath("/", "layout");
  redirect("/");
}
