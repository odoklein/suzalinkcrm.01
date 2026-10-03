DO $$
BEGIN
  -- Ensure Mission.defaultMailboxId FK exists (ignore if already present)
  ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_defaultMailboxId_fkey"
  FOREIGN KEY ("defaultMailboxId") REFERENCES "Mailbox"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

