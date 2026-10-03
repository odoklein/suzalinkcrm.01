-- Add MEETING_CANCELLED to ActionResult enum (idempotent: safe if already applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ActionResult' AND e.enumlabel = 'MEETING_CANCELLED'
  ) THEN
    ALTER TYPE "ActionResult" ADD VALUE 'MEETING_CANCELLED';
  END IF;
END
$$;
