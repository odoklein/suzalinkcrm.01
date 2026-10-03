-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "additionalPhones" JSONB;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "additionalEmails" JSONB;
