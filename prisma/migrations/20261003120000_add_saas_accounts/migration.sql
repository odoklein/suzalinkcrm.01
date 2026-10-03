-- Self-serve SaaS accounts: plans (Indépendant / Small Business / Medium Business),
-- 14-day trials, mock payments, per-plan onboarding, workspaces, phone lines,
-- contact imports, API keys and an account event log. Customers live in
-- SaasMember, never in User. Idempotent (safe to re-run), like the other manual migrations.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasPlanCode" AS ENUM ('INDEPENDANT', 'SMALL_BUSINESS', 'MEDIUM_BUSINESS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasAccountStatus" AS ENUM ('PENDING_PAYMENT', 'TRIALING', 'ACTIVE', 'TRIAL_EXPIRED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SDR', 'CLOSER', 'CLIENT_VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasMemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasPaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasOnboardingStepStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SaasPhoneProvider" AS ENUM ('ALLO', 'ONOFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planCode" "SaasPlanCode" NOT NULL,
    "billingCycle" "SaasBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "SaasAccountStatus" NOT NULL,
    "extraSeats" INTEGER NOT NULL DEFAULT 0,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "setupServiceRequested" BOOLEAN NOT NULL DEFAULT false,
    "companySize" TEXT,
    "industry" TEXT,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "vatNumber" TEXT,
    "siret" TEXT,
    "phone" TEXT,
    "useCase" TEXT,
    "settings" JSONB,
    "whiteLabel" JSONB,
    "onboardingStartedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasMember" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "SaasMemberRole" NOT NULL,
    "status" "SaasMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "jobTitle" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasPayment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "SaasPaymentStatus" NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "planCode" "SaasPlanCode" NOT NULL,
    "billingCycle" "SaasBillingCycle" NOT NULL,
    "extraSeats" INTEGER NOT NULL DEFAULT 0,
    "includesSetup" BOOLEAN NOT NULL DEFAULT false,
    "lines" JSONB NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardholderName" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "invoiceNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasOnboardingStep" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" "SaasOnboardingStepStatus" NOT NULL DEFAULT 'PENDING',
    "data" JSONB,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasOnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasWorkspace" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasPhoneLine" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" "SaasPhoneProvider" NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "label" TEXT,
    "webhookToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasPhoneLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasContactImport" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "validCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "mapping" JSONB NOT NULL,
    "sample" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasContactImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasApiKey" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaasAccountEvent" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaasAccountEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasAccount_slug_key" ON "SaasAccount"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasAccount_status_idx" ON "SaasAccount"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasAccount_planCode_idx" ON "SaasAccount"("planCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasAccount_trialEndsAt_idx" ON "SaasAccount"("trialEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasMember_email_key" ON "SaasMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasMember_inviteTokenHash_key" ON "SaasMember"("inviteTokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasMember_accountId_idx" ON "SaasMember"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasPayment_idempotencyKey_key" ON "SaasPayment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasPayment_invoiceNumber_key" ON "SaasPayment"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasPayment_accountId_createdAt_idx" ON "SaasPayment"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasOnboardingStep_accountId_idx" ON "SaasOnboardingStep"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasOnboardingStep_accountId_stepKey_key" ON "SaasOnboardingStep"("accountId", "stepKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasWorkspace_accountId_idx" ON "SaasWorkspace"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasWorkspace_accountId_name_key" ON "SaasWorkspace"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasPhoneLine_webhookToken_key" ON "SaasPhoneLine"("webhookToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasPhoneLine_accountId_idx" ON "SaasPhoneLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasPhoneLine_accountId_phoneNumber_key" ON "SaasPhoneLine"("accountId", "phoneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasContactImport_accountId_idx" ON "SaasContactImport"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SaasApiKey_keyHash_key" ON "SaasApiKey"("keyHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasApiKey_accountId_idx" ON "SaasApiKey"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasAccountEvent_accountId_createdAt_idx" ON "SaasAccountEvent"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaasAccountEvent_type_idx" ON "SaasAccountEvent"("type");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasMember_accountId_fkey') THEN
    ALTER TABLE "SaasMember" ADD CONSTRAINT "SaasMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasPayment_accountId_fkey') THEN
    ALTER TABLE "SaasPayment" ADD CONSTRAINT "SaasPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasOnboardingStep_accountId_fkey') THEN
    ALTER TABLE "SaasOnboardingStep" ADD CONSTRAINT "SaasOnboardingStep_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasWorkspace_accountId_fkey') THEN
    ALTER TABLE "SaasWorkspace" ADD CONSTRAINT "SaasWorkspace_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasPhoneLine_accountId_fkey') THEN
    ALTER TABLE "SaasPhoneLine" ADD CONSTRAINT "SaasPhoneLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasContactImport_accountId_fkey') THEN
    ALTER TABLE "SaasContactImport" ADD CONSTRAINT "SaasContactImport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasApiKey_accountId_fkey') THEN
    ALTER TABLE "SaasApiKey" ADD CONSTRAINT "SaasApiKey_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SaasAccountEvent_accountId_fkey') THEN
    ALTER TABLE "SaasAccountEvent" ADD CONSTRAINT "SaasAccountEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaasAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

