-- Add MAIL_ENVOYE to ActionResult enum (email actually sent; ENVOIE_MAIL = mail à envoyer, note only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ActionResult' AND e.enumlabel = 'MAIL_ENVOYE'
  ) THEN
    ALTER TYPE "ActionResult" ADD VALUE 'MAIL_ENVOYE';
  END IF;
END
$$;
