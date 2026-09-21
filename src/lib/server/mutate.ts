import "server-only";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { BusinessError, type ActionResult, type Actor } from "@/lib/domain";
import { db } from "./db";

export async function transaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let retry = 0; ; retry++) {
    try {
      return await db().$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        retry < 2
      )
        continue;
      throw error;
    }
  }
}
export async function mutation(
  actor: Actor,
  work: () => Promise<void>,
  message: string,
): Promise<ActionResult> {
  if (actor.demo)
    return {
      ok: false,
      message: "Demonstração somente para consulta. Conecte o Supabase para salvar dados reais.",
    };
  try {
    await work();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof ZodError)
      return { ok: false, message: error.issues[0]?.message ?? "Confira os campos." };
    if (error instanceof BusinessError) return { ok: false, message: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return {
        ok: false,
        message: "Este registro já existe. Atualize a página antes de tentar novamente.",
      };
    const incident = randomUUID();
    console.error("operation_failed", {
      incident,
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "INTERNAL",
    });
    return { ok: false, message: `Não foi possível salvar. Referência: ${incident.slice(0, 8)}.` };
  }
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  entityId: string,
) {
  await tx.auditEvent.create({ data: { memberId: actor.id, action, entityId } });
}
