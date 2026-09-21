import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parseArgs } from "node:util";

try {
  process.loadEnvFile(".env");
} catch {
  /* Permite variáveis injetadas pelo ambiente. */
}
const { values } = parseArgs({
  options: {
    id: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "ADMIN" },
  },
});
const args = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(100),
    role: z.enum(["ADMIN", "OPERATOR"]),
  })
  .parse(values);
const directUrl = z.string().url().parse(process.env.DIRECT_URL);
const client = new PrismaClient({ datasources: { db: { url: directUrl } }, log: [] });
try {
  const users = await client.$queryRaw<
    { id: string }[]
  >`SELECT id FROM auth.users WHERE id = ${args.id}::uuid AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL`;
  if (!users.length) throw new Error("Crie e confirme o usuário no Supabase Auth primeiro.");
  const existing = await client.member.findUnique({ where: { id: args.id } });
  if (existing) throw new Error("Usuário já cadastrado. Altere permissões pela aplicação.");
  await client.$transaction(async (tx) => {
    await tx.member.create({ data: { id: args.id, name: args.name, role: args.role } });
    await tx.auditEvent.create({
      data: { memberId: args.id, entityId: args.id, action: "MEMBER_PROVISIONED" },
    });
  });
  console.info("Usuário autorizado. O próximo acesso exigirá configurar o autenticador.");
} finally {
  await client.$disconnect();
}
