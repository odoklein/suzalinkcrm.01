-- CreateEnum
CREATE TYPE "ActionScopeType" AS ENUM ('GLOBAL', 'CLIENT', 'MISSION', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "ActionPriorityLabel" AS ENUM ('CALLBACK', 'FOLLOW_UP', 'NEW', 'RETRY', 'SKIP');

-- CreateTable
CREATE TABLE "ActionStatusDefinition" (
    "id" TEXT NOT NULL,
    "scopeType" "ActionScopeType" NOT NULL,
    "scopeId" TEXT,
    "code" TEXT NOT NULL,
    "label" TEXT,
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

-- CreateTable
CREATE TABLE "ActionNextStep" (
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

-- CreateIndex (GLOBAL uses scopeId='' for uniqueness)
CREATE UNIQUE INDEX "ActionStatusDefinition_scopeType_scopeId_code_key" ON "ActionStatusDefinition"("scopeType", "scopeId", "code");

-- CreateIndex
CREATE INDEX "ActionStatusDefinition_scopeType_scopeId_idx" ON "ActionStatusDefinition"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "ActionNextStep_scopeType_scopeId_idx" ON "ActionNextStep"("scopeType", "scopeId");
