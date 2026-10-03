-- Add SAS RDV confirmation workflow + fiche fields

-- 1) Enum
DO $$ BEGIN
    CREATE TYPE "MeetingConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2) Columns on Action
ALTER TABLE "Action"
ADD COLUMN IF NOT EXISTS "confirmationStatus" "MeetingConfirmationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "confirmationUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "confirmedById" TEXT,
ADD COLUMN IF NOT EXISTS "rdvFiche" JSONB,
ADD COLUMN IF NOT EXISTS "rdvFicheUpdatedAt" TIMESTAMP(3);

-- 3) FK to User (manager who confirmed)
DO $$ BEGIN
    ALTER TABLE "Action"
    ADD CONSTRAINT "Action_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Optional: filter performance
CREATE INDEX IF NOT EXISTS "Action_confirmationStatus_idx" ON "Action"("confirmationStatus");

