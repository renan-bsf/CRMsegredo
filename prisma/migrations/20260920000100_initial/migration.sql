-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "private";

-- CreateEnum
CREATE TYPE "private"."Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "private"."Category" AS ENUM ('LINGERIE', 'BEACHWEAR', 'WELLNESS');

-- CreateEnum
CREATE TYPE "private"."ProductType" AS ENUM ('SET', 'TOP', 'BOTTOM', 'COSMETIC', 'ELECTRONIC', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "private"."PaymentMethod" AS ENUM ('PIX', 'CASH', 'DEBIT', 'CREDIT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "private"."PaymentStatus" AS ENUM ('PAID', 'PENDING');

-- CreateEnum
CREATE TYPE "private"."SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "private"."MovementType" AS ENUM ('RECEIPT', 'SALE', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "private"."ExpenseType" AS ENUM ('OPERATING', 'PRO_LABORE');

-- CreateTable
CREATE TABLE "private"."Member" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "private"."Role" NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Customer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "profileEncrypted" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Product" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "private"."Category" NOT NULL,
    "type" "private"."ProductType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Variant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "color" VARCHAR(50) NOT NULL,
    "size" VARCHAR(30) NOT NULL,
    "braBand" INTEGER,
    "braCup" VARCHAR(3),
    "bottomSize" VARCHAR(20),
    "power" VARCHAR(60),
    "priceCents" INTEGER NOT NULL,
    "minStock" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Batch" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "expiresAt" DATE,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Sale" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "customerId" UUID,
    "memberId" UUID NOT NULL,
    "status" "private"."SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "paymentMethod" "private"."PaymentMethod" NOT NULL,
    "paymentStatus" "private"."PaymentStatus" NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."SaleItem" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "description" VARCHAR(240) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."SaleAllocation" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "SaleAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."StockMovement" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "type" "private"."MovementType" NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."Expense" (
    "id" UUID NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "type" "private"."ExpenseType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" DATE NOT NULL,
    "memberId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "private"."AuditEvent" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_active_name_idx" ON "private"."Customer"("active", "name");

-- CreateIndex
CREATE INDEX "Product_active_category_idx" ON "private"."Product"("active", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "private"."Variant"("sku");

-- CreateIndex
CREATE INDEX "Variant_productId_active_idx" ON "private"."Variant"("productId", "active");

-- CreateIndex
CREATE INDEX "Batch_variantId_expiresAt_idx" ON "private"."Batch"("variantId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_variantId_code_key" ON "private"."Batch"("variantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_number_key" ON "private"."Sale"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "private"."Sale"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Sale_createdAt_status_idx" ON "private"."Sale"("createdAt", "status");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "private"."Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_memberId_idx" ON "private"."Sale"("memberId");

-- CreateIndex
CREATE INDEX "Sale_status_paymentStatus_idx" ON "private"."Sale"("status", "paymentStatus");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "private"."SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_variantId_idx" ON "private"."SaleItem"("variantId");

-- CreateIndex
CREATE INDEX "SaleAllocation_itemId_idx" ON "private"."SaleAllocation"("itemId");

-- CreateIndex
CREATE INDEX "SaleAllocation_batchId_idx" ON "private"."SaleAllocation"("batchId");

-- CreateIndex
CREATE INDEX "StockMovement_batchId_createdAt_idx" ON "private"."StockMovement"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_memberId_idx" ON "private"."StockMovement"("memberId");

-- CreateIndex
CREATE INDEX "Expense_occurredAt_type_idx" ON "private"."Expense"("occurredAt", "type");

-- CreateIndex
CREATE INDEX "Expense_memberId_idx" ON "private"."Expense"("memberId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "private"."AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_memberId_idx" ON "private"."AuditEvent"("memberId");

-- AddForeignKey
ALTER TABLE "private"."Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "private"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."Batch" ADD CONSTRAINT "Batch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "private"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "private"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."Sale" ADD CONSTRAINT "Sale_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "private"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "private"."Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "private"."Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."SaleAllocation" ADD CONSTRAINT "SaleAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "private"."SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."SaleAllocation" ADD CONSTRAINT "SaleAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "private"."Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."StockMovement" ADD CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "private"."Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."StockMovement" ADD CONSTRAINT "StockMovement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "private"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."Expense" ADD CONSTRAINT "Expense_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "private"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "private"."AuditEvent" ADD CONSTRAINT "AuditEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "private"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
