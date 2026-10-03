-- CreateEnum for SessionTaskRole (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionTaskRole') THEN
    CREATE TYPE "SessionTaskRole" AS ENUM ('SDR', 'MANAGER', 'DEV', 'ALWAYS');
  END IF;
END
$$;

-- CreateEnum for SessionTaskPriority (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SessionTaskPriority') THEN
    CREATE TYPE "SessionTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END
$$;

-- Add assigneeRole to SessionTask if missing
ALTER TABLE "SessionTask" ADD COLUMN IF NOT EXISTS "assigneeRole" "SessionTaskRole" NOT NULL DEFAULT 'ALWAYS';

-- Add priority to SessionTask if missing
ALTER TABLE "SessionTask" ADD COLUMN IF NOT EXISTS "priority" "SessionTaskPriority" NOT NULL DEFAULT 'MEDIUM';

-- Create index on assigneeRole (ignore if exists)
CREATE INDEX IF NOT EXISTS "SessionTask_assigneeRole_idx" ON "SessionTask"("assigneeRole");

-- Create index on doneAt (ignore if exists)
CREATE INDEX IF NOT EXISTS "SessionTask_doneAt_idx" ON "SessionTask"("doneAt");
