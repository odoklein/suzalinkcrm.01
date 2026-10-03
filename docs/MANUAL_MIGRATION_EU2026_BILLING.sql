-- ============================================
-- EU 2026 Billing Compliance Migration
-- Run this SQL against your PostgreSQL database
-- ============================================

-- 1. New enums
DO $$ BEGIN
    CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceTransactionType" AS ENUM (
        'B2B_DOMESTIC', 'B2B_INTRA_EU', 'B2B_EXPORT',
        'B2C_DOMESTIC', 'B2C_INTRA_EU', 'B2C_EXPORT'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PdpSubmissionStatus" AS ENUM (
        'NOT_SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'ERROR'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend InvoiceStatus enum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

-- 3. CompanyIssuer - new legal/payment fields
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "legalForm" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "capitalSocial" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "rcsCity" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "rcsNumber" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "bic" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultLatePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultEarlyPaymentDiscount" TEXT;

-- 4. Invoice - new fields
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'INVOICE';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentTermsText" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "latePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "earlyPaymentDiscount" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "relatedInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "transactionType" "InvoiceTransactionType" NOT NULL DEFAULT 'B2B_DOMESTIC';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionStatus" "PdpSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpResponseData" JSONB;

-- 5. Foreign key for credit note relation
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" 
    FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Create InvoiceAuditLog table
CREATE TABLE IF NOT EXISTS "InvoiceAuditLog" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. New indexes
CREATE INDEX IF NOT EXISTS "Invoice_documentType_idx" ON "Invoice"("documentType");
CREATE INDEX IF NOT EXISTS "Invoice_relatedInvoiceId_idx" ON "Invoice"("relatedInvoiceId");
CREATE INDEX IF NOT EXISTS "Invoice_transactionType_idx" ON "Invoice"("transactionType");
CREATE INDEX IF NOT EXISTS "Invoice_pdpSubmissionStatus_idx" ON "Invoice"("pdpSubmissionStatus");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_invoiceId_idx" ON "InvoiceAuditLog"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_userId_idx" ON "InvoiceAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_action_idx" ON "InvoiceAuditLog"("action");
