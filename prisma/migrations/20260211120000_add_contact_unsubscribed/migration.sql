-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "unsubscribed" BOOLEAN NOT NULL DEFAULT false;
