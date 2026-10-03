-- Create enum types for Invoice if they don't exist (PostgreSQL)
DO $$ BEGIN
    CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "InvoiceTransactionType" AS ENUM (
        'B2B_DOMESTIC',
        'B2B_INTRA_EU',
        'B2B_EXPORT',
        'B2C_DOMESTIC',
        'B2C_INTRA_EU',
        'B2C_EXPORT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "PdpSubmissionStatus" AS ENUM (
        'NOT_SUBMITTED',
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'ERROR'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add missing columns to Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'INVOICE';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "transactionType" "InvoiceTransactionType" NOT NULL DEFAULT 'B2B_DOMESTIC';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionStatus" "PdpSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmissionId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdpResponseData" JSONB;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "relatedInvoiceId" TEXT;

-- Create index on documentType if not exists (optional; Prisma may have created it)
CREATE INDEX IF NOT EXISTS "Invoice_documentType_idx" ON "Invoice"("documentType");
CREATE INDEX IF NOT EXISTS "Invoice_transactionType_idx" ON "Invoice"("transactionType");
CREATE INDEX IF NOT EXISTS "Invoice_pdpSubmissionStatus_idx" ON "Invoice"("pdpSubmissionStatus");
CREATE INDEX IF NOT EXISTS "Invoice_relatedInvoiceId_idx" ON "Invoice"("relatedInvoiceId");
