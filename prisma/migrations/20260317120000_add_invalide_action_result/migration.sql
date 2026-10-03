-- Add INVALIDE to ActionResult enum (distinct from MEETING_CANCELLED; used for invalid lead)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ActionResult' AND e.enumlabel = 'INVALIDE'
  ) THEN
    ALTER TYPE "ActionResult" ADD VALUE 'INVALIDE';
  END IF;
END
$$;
