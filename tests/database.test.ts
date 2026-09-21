import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let pg: PGlite;
const id = "00000000-0000-4000-8000-000000000001";
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.sessions (id uuid, user_id uuid, not_after timestamptz);
    ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;`);
  for (const name of [
    "20260920000100_initial",
    "20260920000200_security",
    "20260921132900_purchasing",
  ])
    await pg.exec(await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
  await pg.exec(`INSERT INTO private."Member" (id,name,role) VALUES ('${id}','Sócia teste','ADMIN');
    INSERT INTO private."Product" (id,name,category,type) VALUES ('${id}','Produto teste','LINGERIE','SET');
    INSERT INTO private."Variant" (id,"productId",sku,color,size,"priceCents") VALUES ('${id}','${id}','TEST-1','Preto','40B',10000);
    INSERT INTO private."Batch" (id,"variantId",code,quantity,"unitCostCents") VALUES ('${id}','${id}','LOTE-1',2,4000);`);
}, 30000);
afterAll(async () => {
  await pg?.close();
});
describe("migrações PostgreSQL e limites de acesso", () => {
  it("ativa RLS em todas as tabelas do domínio", async () => {
    const { rows } = await pg.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace = 'private'::regnamespace AND relkind='r'",
    );
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
  });
  it("recusa acesso por anon e authenticated", async () => {
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`SET ROLE ${role}`);
      try {
        await expect(pg.query('SELECT * FROM private."Customer"')).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await pg.exec("RESET ROLE");
      }
    }
  });
  it("permite o backend restrito, mas recusa DELETE, DDL e alteração de auditoria", async () => {
    await pg.exec("SET ROLE gestao_app");
    try {
      expect((await pg.query('SELECT id FROM private."Variant"')).rows).toHaveLength(1);
      await expect(pg.exec('DELETE FROM private."Member"')).rejects.toThrow(/permission denied/);
      await expect(pg.exec("CREATE TABLE private.hacked(id int)")).rejects.toThrow(
        /permission denied/,
      );
      await expect(pg.exec("UPDATE private.\"AuditEvent\" SET action='TAMPERED'")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await pg.exec("RESET ROLE");
    }
  });
  it("expõe somente a validade da sessão autenticada, sem liberar auth.sessions", async () => {
    await pg.exec(
      `INSERT INTO auth.sessions (id,user_id,not_after) VALUES ('${id}','${id}',now() + interval '1 day')`,
    );
    await pg.exec("SET ROLE gestao_app");
    try {
      await expect(pg.query("SELECT * FROM auth.sessions")).rejects.toThrow(/permission denied/);
      await pg.exec(`SELECT set_config('request.jwt.claim.sub','${id}',false)`);
      const valid = await pg.query<{ valid: boolean }>(
        `SELECT private.session_is_active('${id}','${id}') AS valid`,
      );
      expect(valid.rows[0]?.valid).toBe(true);
      const wrong = await pg.query<{ valid: boolean }>(
        `SELECT private.session_is_active('${id}','00000000-0000-4000-8000-000000000002') AS valid`,
      );
      expect(wrong.rows[0]?.valid).toBe(false);
    } finally {
      await pg.exec("RESET ROLE");
    }
  });
  it("recusa estoque negativo e faz rollback integral", async () => {
    await expect(
      pg.transaction(async (tx) => {
        await tx.exec(`UPDATE private."Batch" SET quantity=1 WHERE id='${id}'`);
        await tx.exec(`UPDATE private."Batch" SET quantity=-1 WHERE id='${id}'`);
      }),
    ).rejects.toThrow(/batch_quantity_nonnegative/);
    expect(
      (await pg.query<{ quantity: number }>('SELECT quantity FROM private."Batch"')).rows[0]
        ?.quantity,
    ).toBe(2);
  });
  it("baixa condicional impede saldo excedido", async () => {
    const first = await pg.query(
      `UPDATE private."Batch" SET quantity=quantity-2 WHERE id='${id}' AND quantity>=2 RETURNING id`,
    );
    const second = await pg.query(
      `UPDATE private."Batch" SET quantity=quantity-2 WHERE id='${id}' AND quantity>=2 RETURNING id`,
    );
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
  });
  it("rejeita total de venda inconsistente", async () => {
    await expect(
      pg.exec(
        `INSERT INTO private."Sale" (id,"idempotencyKey","requestHash","memberId","paymentMethod","paymentStatus","subtotalCents","discountCents","totalCents","costCents","paidAt") VALUES ('${id}','${id}','hash','${id}','PIX','PAID',1000,100,1000,300,now())`,
      ),
    ).rejects.toThrow(/sale_values_consistent/);
  });
});

describe("integridade das compras no PostgreSQL", () => {
  const documentId = "00000000-0000-4000-8000-000000000010";
  it("protege documentos e itens de acesso público e exclusão pelo runtime", async () => {
    for (const role of ["anon", "authenticated", "gestao_app"]) {
      await pg.exec(`SET ROLE ${role}`);
      try {
        for (const table of ["PurchaseDocument", "PurchaseItem"]) {
          if (role === "gestao_app") {
            await pg.query(`SELECT id FROM private."${table}"`);
            await expect(pg.exec(`DELETE FROM private."${table}"`)).rejects.toThrow(
              /permission denied/,
            );
          } else {
            await expect(pg.query(`SELECT id FROM private."${table}"`)).rejects.toThrow(
              /permission denied/,
            );
          }
        }
      } finally {
        await pg.exec("RESET ROLE");
      }
    }
  });
  it("recusa documento repetido e recebimento de pedido", async () => {
    const insert = (key: string, number: string) => `INSERT INTO private."PurchaseDocument"
      (id,"idempotencyKey",kind,"supplierName","supplierTaxId","supplierKey",number,"issuedAt","totalCents","memberId")
      VALUES ('${key}','${key}','ORDER','Fornecedor','12345678000190','12345678000190','${number}','2026-09-21',8000,'${id}')`;
    await pg.exec(insert(documentId, "PED-1"));
    await expect(pg.exec(insert("00000000-0000-4000-8000-000000000011", "PED-1"))).rejects.toThrow(
      /unique constraint/,
    );
    await expect(
      pg.exec(
        `UPDATE private."PurchaseDocument" SET status='RECEIVED',"receivedAt"=now() WHERE id='${documentId}'`,
      ),
    ).rejects.toThrow(/purchase_status/);
    await expect(
      pg.exec(
        `UPDATE private."PurchaseDocument" SET status='CANCELLED',"cancelledAt"=now() WHERE id='${documentId}'`,
      ),
    ).rejects.toThrow(/purchase_status/);
  });
  it("faz rollback do status, lote e itens se uma entrada falha", async () => {
    const invoiceId = "00000000-0000-4000-8000-000000000012";
    await pg.exec(`INSERT INTO private."PurchaseDocument"
      (id,"idempotencyKey",kind,"supplierName","supplierTaxId","supplierKey",number,"issuedAt","totalCents","memberId")
      VALUES ('${invoiceId}','${invoiceId}','INVOICE','Fornecedor','12345678000190','12345678000190','NF-1','2026-09-21',8000,'${id}')`);
    const before = (
      await pg.query<{ quantity: number }>(`SELECT quantity FROM private."Batch" WHERE id='${id}'`)
    ).rows[0]!.quantity;
    await expect(
      pg.transaction(async (tx) => {
        await tx.exec(
          `UPDATE private."PurchaseDocument" SET status='RECEIVED',"receivedAt"=now() WHERE id='${invoiceId}' AND status='REGISTERED'`,
        );
        await tx.exec(`UPDATE private."Batch" SET quantity=quantity+2 WHERE id='${id}'`);
        await tx.exec(`INSERT INTO private."PurchaseItem" (id,"documentId","variantId",description,quantity,"unitCostCents","lotCode")
        VALUES ('${invoiceId}','${invoiceId}','${id}','Inválido',-1,4000,'L1')`);
      }),
    ).rejects.toThrow(/check constraint/);
    expect(
      (
        await pg.query<{ quantity: number }>(
          `SELECT quantity FROM private."Batch" WHERE id='${id}'`,
        )
      ).rows[0]!.quantity,
    ).toBe(before);
    expect(
      (
        await pg.query<{ status: string }>(
          `SELECT status FROM private."PurchaseDocument" WHERE id='${invoiceId}'`,
        )
      ).rows[0]!.status,
    ).toBe("REGISTERED");
    const first = await pg.query(
      `UPDATE private."PurchaseDocument" SET status='RECEIVED',"receivedAt"=now() WHERE id='${invoiceId}' AND status='REGISTERED' RETURNING id`,
    );
    const again = await pg.query(
      `UPDATE private."PurchaseDocument" SET status='RECEIVED',"receivedAt"=now() WHERE id='${invoiceId}' AND status='REGISTERED' RETURNING id`,
    );
    expect(first.rows).toHaveLength(1);
    expect(again.rows).toHaveLength(0);
  });
});
