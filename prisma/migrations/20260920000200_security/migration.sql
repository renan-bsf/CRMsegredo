-- Runtime restrito: não é dono das tabelas, não pode DDL e não ignora RLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gestao_app') THEN
    CREATE ROLE gestao_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO gestao_app;
GRANT SELECT, INSERT, UPDATE ON private."Member", private."Customer", private."Product", private."Variant", private."Batch", private."Sale", private."SaleItem", private."SaleAllocation", private."StockMovement", private."Expense", private."AuditEvent" TO gestao_app;
GRANT USAGE, SELECT ON SEQUENCE private."Sale_number_seq" TO gestao_app;
-- Auditoria e movimentos são append-only para a aplicação.
REVOKE UPDATE ON private."AuditEvent", private."StockMovement", private."SaleAllocation", private."SaleItem" FROM gestao_app;

-- auth.sessions possui RLS. Esta função expõe somente um booleano e exige que o
-- usuário passado corresponda ao claim autenticado definido na transação.
CREATE OR REPLACE FUNCTION private.session_is_active(p_session_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) = p_user_id
    AND EXISTS (
      SELECT 1
      FROM auth.sessions AS s
      WHERE s.id = p_session_id
        AND s.user_id = p_user_id
        AND (s.not_after IS NULL OR s.not_after > now())
    );
$$;
REVOKE ALL ON FUNCTION private.session_is_active(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.session_is_active(uuid, uuid) TO gestao_app;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['Member', 'Customer', 'Product', 'Variant', 'Batch', 'Sale', 'SaleItem', 'SaleAllocation', 'StockMovement', 'Expense', 'AuditEvent'] LOOP
    EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE private.%I FORCE ROW LEVEL SECURITY', table_name);
    -- Role de backend apenas, sem acesso pelo Data API nem por JWT de cliente.
    EXECUTE format('CREATE POLICY backend_access ON private.%I TO gestao_app USING (true) WITH CHECK (true)', table_name);
  END LOOP;
END $$;

ALTER TABLE private."Variant" ADD CONSTRAINT variant_price_positive CHECK ("priceCents" > 0 AND "priceCents" <= 100000000);
ALTER TABLE private."Variant" ADD CONSTRAINT variant_min_stock_nonnegative CHECK ("minStock" >= 0);
ALTER TABLE private."Batch" ADD CONSTRAINT batch_quantity_nonnegative CHECK (quantity >= 0);
ALTER TABLE private."Batch" ADD CONSTRAINT batch_cost_nonnegative CHECK ("unitCostCents" >= 0 AND "unitCostCents" <= 100000000);
ALTER TABLE private."Sale" ADD CONSTRAINT sale_values_consistent CHECK (
  "subtotalCents" > 0 AND "discountCents" >= 0 AND "discountCents" <= "subtotalCents"
  AND "totalCents" = "subtotalCents" - "discountCents" AND "costCents" >= 0
);
ALTER TABLE private."Sale" ADD CONSTRAINT sale_paid_consistent CHECK (
  ("paymentStatus" = 'PAID' AND "paidAt" IS NOT NULL) OR ("paymentStatus" = 'PENDING' AND "paidAt" IS NULL)
);
ALTER TABLE private."Sale" ADD CONSTRAINT sale_pending_customer CHECK ("paymentStatus" <> 'PENDING' OR "customerId" IS NOT NULL);
ALTER TABLE private."Sale" ADD CONSTRAINT sale_cancelled_consistent CHECK (
  (status = 'CANCELLED' AND "cancelledAt" IS NOT NULL) OR (status = 'COMPLETED' AND "cancelledAt" IS NULL)
);
ALTER TABLE private."SaleItem" ADD CONSTRAINT sale_item_valid CHECK (quantity > 0 AND "unitPriceCents" > 0 AND "costCents" >= 0);
ALTER TABLE private."SaleAllocation" ADD CONSTRAINT allocation_quantity_positive CHECK (quantity > 0);
ALTER TABLE private."Expense" ADD CONSTRAINT expense_amount_positive CHECK ("amountCents" > 0);
ALTER TABLE private."StockMovement" ADD CONSTRAINT movement_nonzero CHECK (delta <> 0);
