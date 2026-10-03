-- =============================================
-- Create first admin (Manager)
-- Run in Supabase SQL Editor
-- =============================================
-- Email:    admin@captain-prospect.fr
-- Password: Captain123@
-- Role:     MANAGER
-- =============================================

INSERT INTO "User" (
  "id",
  "email",
  "password",
  "name",
  "role",
  "isActive",
  "clientId",
  "clientOnboardingDismissedPermanently",
  "createdAt",
  "updatedAt"
) VALUES (
  'admin-001',
  'admin@captain-prospect.fr',
  '$2b$10$77B7DwAjfaPDHgJCQkfF8eNiIDOavFYc2peokFCBX3PPbhYd9C9jm',
  'Admin Captain Prospect',
  'MANAGER',
  true,
  NULL,
  false,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "password" = EXCLUDED."password",
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();
