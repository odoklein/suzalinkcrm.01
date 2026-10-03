-- AlterTable
-- Add EU 2026 compliance and bank/payment fields to CompanyIssuer (columns may already exist from initial schema)
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "legalForm" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "capitalSocial" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "rcsCity" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "rcsNumber" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "iban" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "bic" TEXT;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultLatePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "CompanyIssuer" ADD COLUMN IF NOT EXISTS "defaultEarlyPaymentDiscount" TEXT;
