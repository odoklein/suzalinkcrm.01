-- =============================================
-- Captain Prospect CRM DATABASE SETUP
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. CREATE ENUMS
CREATE TYPE "UserRole" AS ENUM ('SDR', 'MANAGER', 'CLIENT');
CREATE TYPE "Channel" AS ENUM ('CALL', 'EMAIL', 'LINKEDIN');
CREATE TYPE "ListType" AS ENUM ('SUZALI', 'CLIENT', 'MIXED');
CREATE TYPE "CompletenessStatus" AS ENUM ('INCOMPLETE', 'PARTIAL', 'ACTIONABLE');
CREATE TYPE "ActionResult" AS ENUM ('NO_RESPONSE', 'BAD_CONTACT', 'INTERESTED', 'CALLBACK_REQUESTED', 'MEETING_BOOKED', 'DISQUALIFIED');
CREATE TYPE "Urgency" AS ENUM ('SHORT', 'MEDIUM', 'LONG');

-- 2. CREATE TABLES

-- Client table
CREATE TABLE "Client" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- User table
CREATE TABLE "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_email_key" UNIQUE ("email"),
    CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Mission table
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- SDR Assignment table
CREATE TABLE "SDRAssignment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "missionId" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SDRAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SDRAssignment_missionId_sdrId_key" UNIQUE ("missionId", "sdrId"),
    CONSTRAINT "SDRAssignment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SDRAssignment_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Campaign table
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "missionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icp" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "script" TEXT,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Campaign_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- List table
CREATE TABLE "List" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "missionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ListType" NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "List_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "List_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Company table
CREATE TABLE "Company" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "size" TEXT,
    "status" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Company_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Contact table
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedin" TEXT,
    "status" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Action table
CREATE TABLE "Action" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "contactId" TEXT NOT NULL,
    "sdrId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "result" "ActionResult" NOT NULL,
    "note" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Action_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Action_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Action_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Action_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Opportunity table
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "needSummary" TEXT NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "estimatedMin" DOUBLE PRECISION,
    "estimatedMax" DOUBLE PRECISION,
    "handedOff" BOOLEAN NOT NULL DEFAULT false,
    "handedOffAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================
-- 3. SEED TEST DATA
-- =============================================

-- Password: test123 (bcrypt hashed)
-- You can generate new hashes at: https://bcrypt-generator.com/

-- Create test client
INSERT INTO "Client" ("id", "name", "email") VALUES
('client-001', 'TechCorp Solutions', 'contact@techcorp.com');

-- Create test users (password: test123)
INSERT INTO "User" ("id", "email", "password", "name", "role", "clientId") VALUES
('sdr-001', 'sdr@suzali.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Marie Laurent', 'SDR', NULL),
('mgr-001', 'manager@suzali.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Thomas Durand', 'MANAGER', NULL),
('client-user-001', 'client@techcorp.com', '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdoMJdoQmFlXo8Yb4QMmYAqMGt2', 'Jean Dupont', 'CLIENT', 'client-001');

-- Create test mission
INSERT INTO "Mission" ("id", "clientId", "name", "objective", "channel", "startDate", "endDate", "isActive") VALUES
('mission-001', 'client-001', 'Prospection SaaS Q1 2026', 'Générer 50 meetings qualifiés', 'CALL', '2026-01-01', '2026-03-31', true);

-- Assign SDR to mission
INSERT INTO "SDRAssignment" ("id", "missionId", "sdrId") VALUES
('assign-001', 'mission-001', 'sdr-001');

-- Create test campaign
INSERT INTO "Campaign" ("id", "missionId", "name", "icp", "pitch", "script", "isActive") VALUES
('campaign-001', 'mission-001', 'Outbound Calls - Tech Startups', 'Tech startups, 10-50 employees, Series A/B', 
'Bonjour, je vous appelle de la part de TechCorp. Je souhaitais échanger quelques minutes concernant vos besoins en solutions digitales.',
'1. Introduction
2. Qualification du besoin
3. Proposition de RDV
4. Confirmation', true);

-- Create test list
INSERT INTO "List" ("id", "missionId", "name", "type", "source") VALUES
('list-001', 'mission-001', 'Tech Startups France', 'SUZALI', 'Apollo');

-- Create test companies
INSERT INTO "Company" ("id", "listId", "name", "country", "industry", "status") VALUES
('company-001', 'list-001', 'Innovatech', 'France', 'SaaS', 'ACTIONABLE'),
('company-002', 'list-001', 'DataFlow', 'France', 'Analytics', 'ACTIONABLE'),
('company-003', 'list-001', 'CloudNine', 'France', 'Cloud', 'ACTIONABLE');

-- Create test contacts
INSERT INTO "Contact" ("id", "companyId", "firstName", "lastName", "title", "email", "phone", "status") VALUES
('contact-001', 'company-001', 'Sophie', 'Martin', 'CEO', 'sophie@innovatech.com', '+33 6 12 34 56 78', 'ACTIONABLE'),
('contact-002', 'company-002', 'Pierre', 'Dubois', 'CTO', 'pierre@dataflow.com', '+33 6 23 45 67 89', 'ACTIONABLE'),
('contact-003', 'company-003', 'Marie', 'Laurent', 'COO', 'marie@cloudnine.com', '+33 6 34 56 78 90', 'ACTIONABLE');

-- =============================================
-- DONE! Test credentials:
-- =============================================
-- SDR:      sdr@suzali.com / test123
-- Manager:  manager@suzali.com / test123  
-- Client:   client@techcorp.com / test123
-- =============================================
