-- =============================================
-- Captain Prospect CRM - SEED TEST DATA ONLY
-- Run this in Supabase SQL Editor
-- =============================================

-- Create test client
INSERT INTO "Client" ("id", "name", "email", "updatedAt") VALUES
('client-001', 'TechCorp Solutions', 'contact@techcorp.com', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create test users (password: test123)
INSERT INTO "User" ("id", "email", "password", "name", "role", "clientId", "updatedAt") VALUES
('sdr-001', 'sdr@suzali.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Marie Laurent', 'SDR', NULL, NOW()),
('mgr-001', 'manager@suzali.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Thomas Durand', 'MANAGER', NULL, NOW()),
('client-user-001', 'client@techcorp.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Jean Dupont', 'CLIENT', 'client-001', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create test mission
INSERT INTO "Mission" ("id", "clientId", "name", "objective", "channel", "startDate", "endDate", "isActive", "updatedAt") VALUES
('mission-001', 'client-001', 'Prospection SaaS Q1 2026', 'Générer 50 meetings qualifiés', 'CALL', '2026-01-01', '2026-03-31', true, NOW())
ON CONFLICT ("id") DO NOTHING;

-- Assign SDR to mission
INSERT INTO "SDRAssignment" ("id", "missionId", "sdrId") VALUES
('assign-001', 'mission-001', 'sdr-001')
ON CONFLICT ("id") DO NOTHING;

-- Create test campaign
INSERT INTO "Campaign" ("id", "missionId", "name", "icp", "pitch", "script", "isActive", "updatedAt") VALUES
('campaign-001', 'mission-001', 'Outbound Calls - Tech Startups', 'Tech startups, 10-50 employees, Series A/B', 
'Bonjour, je vous appelle de la part de TechCorp. Je souhaitais échanger quelques minutes concernant vos besoins en solutions digitales.',
'1. Introduction
2. Qualification du besoin
3. Proposition de RDV
4. Confirmation', true, NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create test list
INSERT INTO "List" ("id", "missionId", "name", "type", "source", "updatedAt") VALUES
('list-001', 'mission-001', 'Tech Startups France', 'SUZALI', 'Apollo', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create test companies
INSERT INTO "Company" ("id", "listId", "name", "country", "industry", "status", "updatedAt") VALUES
('company-001', 'list-001', 'Innovatech', 'France', 'SaaS', 'ACTIONABLE', NOW()),
('company-002', 'list-001', 'DataFlow', 'France', 'Analytics', 'ACTIONABLE', NOW()),
('company-003', 'list-001', 'CloudNine', 'France', 'Cloud', 'ACTIONABLE', NOW())
ON CONFLICT ("id") DO NOTHING;

-- Create test contacts
INSERT INTO "Contact" ("id", "companyId", "firstName", "lastName", "title", "email", "phone", "status", "updatedAt") VALUES
('contact-001', 'company-001', 'Sophie', 'Martin', 'CEO', 'sophie@innovatech.com', '+33 6 12 34 56 78', 'ACTIONABLE', NOW()),
('contact-002', 'company-002', 'Pierre', 'Dubois', 'CTO', 'pierre@dataflow.com', '+33 6 23 45 67 89', 'ACTIONABLE', NOW()),
('contact-003', 'company-003', 'Marie', 'Laurent', 'COO', 'marie@cloudnine.com', '+33 6 34 56 78 90', 'ACTIONABLE', NOW())
ON CONFLICT ("id") DO NOTHING;

-- =============================================
-- DONE! Test credentials:
-- =============================================
-- SDR:      sdr@suzali.com / test123
-- Manager:  manager@suzali.com / test123  
-- Client:   client@techcorp.com / test123
-- =============================================
