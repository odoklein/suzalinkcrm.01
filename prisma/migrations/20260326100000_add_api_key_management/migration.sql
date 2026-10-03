-- ============================================
-- MIGRATION: Add API Key Management Tables
-- ============================================

-- Create ApiKey table
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL UNIQUE,
    "keyPrefix" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "clientId" TEXT,
    "missionId" TEXT,
    "allowedEndpoints" JSONB NOT NULL DEFAULT '["/api/stats","/api/stats/missions-summary"]',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "rateLimitPerHour" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes for ApiKey
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_isActive_idx" ON "ApiKey"("isActive");
CREATE INDEX "ApiKey_clientId_idx" ON "ApiKey"("clientId");
CREATE INDEX "ApiKey_createdById_idx" ON "ApiKey"("createdById");

-- Create ApiKeyUsageLog table
CREATE TABLE "ApiKeyUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "apiKeyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyUsageLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for ApiKeyUsageLog
CREATE INDEX "ApiKeyUsageLog_apiKeyId_idx" ON "ApiKeyUsageLog"("apiKeyId");
CREATE INDEX "ApiKeyUsageLog_createdAt_idx" ON "ApiKeyUsageLog"("createdAt");
CREATE INDEX "ApiKeyUsageLog_endpoint_idx" ON "ApiKeyUsageLog"("endpoint");

-- Create ExternalEndpoint table
CREATE TABLE "ExternalEndpoint" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "path" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "methods" TEXT[] DEFAULT ARRAY['GET'],
    "minRole" "UserRole" NOT NULL DEFAULT 'MANAGER',
    "supportsClientScope" BOOLEAN NOT NULL DEFAULT true,
    "supportsMissionScope" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultRateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "defaultRateLimitPerHour" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for ExternalEndpoint
CREATE INDEX "ExternalEndpoint_isEnabled_idx" ON "ExternalEndpoint"("isEnabled");

-- Seed default external endpoints
INSERT INTO "ExternalEndpoint" ("id", "path", "name", "description", "methods", "minRole", "isEnabled", "supportsClientScope", "supportsMissionScope")
VALUES 
    (gen_random_uuid(), '/api/stats', 'Dashboard Statistics', 'Get dashboard statistics including actions, meetings, and conversion rates', ARRAY['GET'], 'MANAGER', true, true, true),
    (gen_random_uuid(), '/api/stats/missions-summary', 'Missions Summary', 'Get summary of active missions with activity metrics', ARRAY['GET'], 'MANAGER', true, false, false),
    (gen_random_uuid(), '/api/prospects/intake', 'Prospect Intake', 'External lead intake endpoint for webhooks and API submissions', ARRAY['POST'], 'MANAGER', true, true, false)
ON CONFLICT ("path") DO NOTHING;
