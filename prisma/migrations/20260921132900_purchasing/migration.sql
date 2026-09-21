BEGIN;
CREATE TYPE private."PurchaseKind" AS ENUM ('ORDER','INVOICE');
CREATE TYPE private."PurchaseStatus" AS ENUM ('REGISTERED','RECEIVED','CANCELLED');
CREATE TABLE private."PurchaseDocument" (
  id uuid PRIMARY KEY,
  "idempotencyKey" uuid NOT NULL UNIQUE,
  kind private."PurchaseKind" NOT NULL,
  status private."PurchaseStatus" NOT NULL DEFAULT 'REGISTERED',
  "supplierName" varchar(160) NOT NULL,
  "supplierTaxId" varchar(14) NOT NULL,
  "supplierKey" varchar(160) NOT NULL,
  number varchar(40) NOT NULL,
  series varchar(10) NOT NULL DEFAULT '',
  "accessKey" varchar(44) UNIQUE,
  "issuedAt" date NOT NULL,
  "expectedAt" date,
  notes varchar(2000) NOT NULL DEFAULT '',
  "totalCents" integer NOT NULL,
  "memberId" uuid NOT NULL REFERENCES private."Member"(id) ON DELETE RESTRICT,
  "sourceOrderId" uuid REFERENCES private."PurchaseDocument"(id) ON DELETE RESTRICT,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" timestamp(3),
  "cancelledAt" timestamp(3),
  "cancelReason" varchar(300),
  CONSTRAINT purchase_total CHECK ("totalCents" > 0 AND "totalCents" <= 100000000),
  CONSTRAINT purchase_source CHECK ("sourceOrderId" IS NULL OR (kind = 'INVOICE' AND "sourceOrderId" <> id)),
  CONSTRAINT purchase_access_key CHECK ("accessKey" IS NULL OR (kind = 'INVOICE' AND "accessKey" ~ '^[0-9]{44}$')),
  CONSTRAINT purchase_status CHECK (
    (status = 'REGISTERED' AND "receivedAt" IS NULL AND "cancelledAt" IS NULL) OR
    (status = 'RECEIVED' AND kind = 'INVOICE' AND "receivedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR
    (status = 'CANCELLED' AND "receivedAt" IS NULL AND "cancelledAt" IS NOT NULL AND "cancelReason" IS NOT NULL AND length("cancelReason") >= 8)
  ),
  UNIQUE (kind, "supplierKey", number, series)
);
CREATE INDEX "PurchaseDocument_issuedAt_id_idx" ON private."PurchaseDocument"("issuedAt",id);
CREATE INDEX "PurchaseDocument_sourceOrderId_idx" ON private."PurchaseDocument"("sourceOrderId");
CREATE INDEX "PurchaseDocument_memberId_idx" ON private."PurchaseDocument"("memberId");
CREATE INDEX "PurchaseDocument_kind_status_idx" ON private."PurchaseDocument"(kind,status);
CREATE TABLE private."PurchaseItem" (
  id uuid PRIMARY KEY,
  "documentId" uuid NOT NULL REFERENCES private."PurchaseDocument"(id) ON DELETE RESTRICT,
  "variantId" uuid NOT NULL REFERENCES private."Variant"(id) ON DELETE RESTRICT,
  description varchar(240) NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10000),
  "unitCostCents" integer NOT NULL CHECK ("unitCostCents" BETWEEN 1 AND 100000000),
  "lotCode" varchar(60) NOT NULL,
  "expiresAt" date,
  "batchId" uuid REFERENCES private."Batch"(id) ON DELETE RESTRICT,
  UNIQUE ("documentId","variantId","lotCode")
);
CREATE INDEX "PurchaseItem_variantId_idx" ON private."PurchaseItem"("variantId");
REVOKE ALL ON private."PurchaseDocument", private."PurchaseItem" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON private."PurchaseDocument", private."PurchaseItem" TO gestao_app;
ALTER TABLE private."PurchaseDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE private."PurchaseDocument" FORCE ROW LEVEL SECURITY;
ALTER TABLE private."PurchaseItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE private."PurchaseItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY backend_access ON private."PurchaseDocument" TO gestao_app USING (true) WITH CHECK (true);
CREATE POLICY backend_access ON private."PurchaseItem" TO gestao_app USING (true) WITH CHECK (true);
CREATE INDEX "PurchaseItem_batchId_idx" ON private."PurchaseItem"("batchId");
COMMIT;
