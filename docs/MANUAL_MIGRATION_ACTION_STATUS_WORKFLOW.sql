-- Run this if you see: relation "ActionStatusDefinition" does not exist
-- Creates enums, ActionStatusDefinition, ActionNextStep, and color column. Safe to run multiple times.

-- 1. Create enums (skip if they already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActionScopeType') THEN
    CREATE TYPE "ActionScopeType" AS ENUM ('GLOBAL', 'CLIENT', 'MISSION', 'CAMPAIGN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActionPriorityLabel') THEN
    CREATE TYPE "ActionPriorityLabel" AS ENUM ('CALLBACK', 'FOLLOW_UP', 'NEW', 'RETRY', 'SKIP');
  END IF;
END $$;

-- 2. Create ActionStatusDefinition table (with color column)
CREATE TABLE IF NOT EXISTS "ActionStatusDefinition" (
    "id" TEXT NOT NULL,
    "scopeType" "ActionScopeType" NOT NULL,
    "scopeId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "priorityLabel" "ActionPriorityLabel" NOT NULL,
    "priorityOrder" INTEGER,
    "triggersOpportunity" BOOLEAN NOT NULL DEFAULT false,
    "triggersCallback" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionStatusDefinition_pkey" PRIMARY KEY ("id")
);

-- 3. Add color column if table was created from an older migration without it
ALTER TABLE "ActionStatusDefinition" ADD COLUMN IF NOT EXISTS "color" TEXT;

-- 4. Create ActionNextStep table
CREATE TABLE IF NOT EXISTS "ActionNextStep" (
    "id" TEXT NOT NULL,
    "scopeType" "ActionScopeType" NOT NULL,
    "scopeId" TEXT,
    "fromResultCode" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "label" TEXT,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionNextStep_pkey" PRIMARY KEY ("id")
);

-- 5. Create indexes (skip if they already exist)
CREATE UNIQUE INDEX IF NOT EXISTS "ActionStatusDefinition_scopeType_scopeId_code_key"
  ON "ActionStatusDefinition"("scopeType", "scopeId", "code");
CREATE INDEX IF NOT EXISTS "ActionStatusDefinition_scopeType_scopeId_idx"
  ON "ActionStatusDefinition"("scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "ActionNextStep_scopeType_scopeId_idx"
  ON "ActionNextStep"("scopeType", "scopeId");
