ALTER TABLE "Mission"
ADD COLUMN "defaultMailboxId" TEXT NULL;

ALTER TABLE "Mission"
ADD CONSTRAINT "Mission_defaultMailboxId_fkey"
FOREIGN KEY ("defaultMailboxId") REFERENCES "Mailbox"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

