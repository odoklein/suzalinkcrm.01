-- Add LinkedIn hub action results to ActionResult enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ActionResult' AND e.enumlabel = 'CONNECTION_SENT') THEN
    ALTER TYPE "ActionResult" ADD VALUE 'CONNECTION_SENT';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ActionResult' AND e.enumlabel = 'MESSAGE_SENT') THEN
    ALTER TYPE "ActionResult" ADD VALUE 'MESSAGE_SENT';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ActionResult' AND e.enumlabel = 'REPLIED') THEN
    ALTER TYPE "ActionResult" ADD VALUE 'REPLIED';
  END IF;
END
$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'ActionResult' AND e.enumlabel = 'NOT_INTERESTED') THEN
    ALTER TYPE "ActionResult" ADD VALUE 'NOT_INTERESTED';
  END IF;
END
$$;
