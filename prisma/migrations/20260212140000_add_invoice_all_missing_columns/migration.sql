-- Add ALL potentially missing columns to Invoice (run this in Supabase SQL editor if you get "column does not exist")
-- Safe to run multiple times: IF NOT EXISTS skips existing columns

-- 1. Enums (skip if already exist)
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SENT', 'PAID', 'CANCELLED', 'PARTIALLY_PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "InvoiceTransactionType" AS ENUM (
        'B2B_DOMESTIC', 'B2B_INTRA_EU', 'B2B_EXPORT',
        'B2C_DOMESTIC', 'B2C_INTRA_EU', 'B2C_EXPORT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE "PdpSubmissionStatus" AS ENUM (
        'NOT_SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'ERROR'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Invoice columns (order doesn't matter)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'INVOICE';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentTermsText" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "latePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "earlyPaymentDiscount" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "facturxPdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "transactionType" "InvoiceTransactionType" NOT NULL DEFAULT 'B2B_DOMESTIC';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionStatus" "PdpSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpResponseData" JSONB;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "relatedInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- 3. Core columns in case table was created with minimal schema
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "billingClientId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "companyIssuerId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "issueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalHt" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalVat" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "totalTtc" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4. Indexes (optional, speed up queries)
CREATE INDEX IF NOT EXISTS "Invoice_documentType_idx" ON "Invoice"("documentType");
CREATE INDEX IF NOT EXISTS "Invoice_transactionType_idx" ON "Invoice"("transactionType");
CREATE INDEX IF NOT EXISTS "Invoice_pdpSubmissionStatus_idx" ON "Invoice"("pdpSubmissionStatus");
CREATE INDEX IF NOT EXISTS "Invoice_relatedInvoiceId_idx" ON "Invoice"("relatedInvoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber") WHERE "invoiceNumber" IS NOT NULL;
