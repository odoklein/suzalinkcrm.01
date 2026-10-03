-- Create InvoiceAuditLog table (required for invoice creation audit trail)
-- Safe to run: IF NOT EXISTS skips if table already exists

CREATE TABLE IF NOT EXISTS "InvoiceAuditLog" (
    "id"        TEXT    NOT NULL,
    "invoiceId" TEXT    NOT NULL,
    "action"    TEXT    NOT NULL,
    "userId"    TEXT    NOT NULL,
    "details"   JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

-- Foreign keys (ignore errors if they already exist)
DO $$ BEGIN
    ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_invoiceId_idx" ON "InvoiceAuditLog"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_userId_idx" ON "InvoiceAuditLog"("userId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditLog_action_idx" ON "InvoiceAuditLog"("action");
