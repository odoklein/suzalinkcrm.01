-- =============================================
-- Captain Prospect CRM - UPDATE PASSWORD HASH
-- Run this in Supabase SQL Editor
-- =============================================

-- Update password for all test users with correct bcrypt hash for "test123"
UPDATE "User" SET "password" = '$2b$10$VhO9a940W9YK8i3/RPXKU.hnGWOXGvuEN/m4RMbrv0zpFkBxLHP5q'
WHERE "email" IN ('sdr@suzali.com', 'manager@suzali.com', 'client@techcorp.com');

-- =============================================
-- DONE! Test credentials:
-- =============================================
-- SDR:      sdr@suzali.com / test123
-- Manager:  manager@suzali.com / test123  
-- Client:   client@techcorp.com / test123
-- =============================================
