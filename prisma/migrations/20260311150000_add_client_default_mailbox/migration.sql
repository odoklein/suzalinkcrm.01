ALTER TABLE "Client"
ADD COLUMN "defaultMailboxId" TEXT NULL;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_defaultMailboxId_fkey"
FOREIGN KEY ("defaultMailboxId") REFERENCES "Mailbox"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

