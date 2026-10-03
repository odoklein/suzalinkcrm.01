-- Add COMMERCIAL to UserRole enum
ALTER TYPE "UserRole" ADD VALUE 'COMMERCIAL';

-- Add interlocuteurId to User model (one-to-one link to ClientInterlocuteur)
ALTER TABLE "User" ADD COLUMN "interlocuteurId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_interlocuteurId_key" UNIQUE ("interlocuteurId");
ALTER TABLE "User" ADD CONSTRAINT "User_interlocuteurId_fkey"
  FOREIGN KEY ("interlocuteurId")
  REFERENCES "ClientInterlocuteur"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add interlocuteurId to Action model (which commercial a meeting was booked for)
ALTER TABLE "Action" ADD COLUMN "interlocuteurId" TEXT;
ALTER TABLE "Action" ADD CONSTRAINT "Action_interlocuteurId_fkey"
  FOREIGN KEY ("interlocuteurId")
  REFERENCES "ClientInterlocuteur"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for lookups
CREATE INDEX "Action_interlocuteurId_idx" ON "Action"("interlocuteurId");
