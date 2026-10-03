-- =============================================
-- Captain Prospect CRM - FULL DATABASE FROM PRISMA SCHEMA
-- Generated from prisma/schema.prisma - Run in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. ENUMS
-- =============================================

CREATE TYPE "UserRole" AS ENUM ('SDR', 'MANAGER', 'CLIENT', 'DEVELOPER', 'BUSINESS_DEVELOPER');
CREATE TYPE "Channel" AS ENUM ('CALL', 'EMAIL', 'LINKEDIN');
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CallStatus" AS ENUM ('queued', 'ringing', 'in_progress', 'completed', 'failed');
CREATE TYPE "ListType" AS ENUM ('SUZALI', 'CLIENT', 'MIXED');
CREATE TYPE "CompletenessStatus" AS ENUM ('INCOMPLETE', 'PARTIAL', 'ACTIONABLE');
CREATE TYPE "ActionResult" AS ENUM ('NO_RESPONSE', 'BAD_CONTACT', 'INTERESTED', 'CALLBACK_REQUESTED', 'MEETING_BOOKED', 'MEETING_CANCELLED', 'DISQUALIFIED', 'ENVOIE_MAIL');
CREATE TYPE "ActionScopeType" AS ENUM ('GLOBAL', 'CLIENT', 'MISSION', 'CAMPAIGN');
CREATE TYPE "ActionPriorityLabel" AS ENUM ('CALLBACK', 'FOLLOW_UP', 'NEW', 'RETRY', 'SKIP');
CREATE TYPE "SyncDirection" AS ENUM ('CRM_TO_DRIVE', 'DRIVE_TO_CRM', 'BIDIRECTIONAL');
CREATE TYPE "Urgency" AS ENUM ('SHORT', 'MEDIUM', 'LONG');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK', 'CUSTOM');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SENT', 'PAID', 'CANCELLED', 'PARTIALLY_PAID');
CREATE TYPE "InvoiceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "InvoiceTransactionType" AS ENUM ('B2B_DOMESTIC', 'B2B_INTRA_EU', 'B2B_EXPORT', 'B2C_DOMESTIC', 'B2C_INTRA_EU', 'B2C_EXPORT');
CREATE TYPE "PdpSubmissionStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'ERROR');
CREATE TYPE "PaymentMatchStatus" AS ENUM ('MATCHED', 'CONFIRMED');
CREATE TYPE "ProspectSourceType" AS ENUM ('WEB_FORM', 'CSV_IMPORT', 'API', 'PARTNER_FEED', 'MANUAL_ENTRY');
CREATE TYPE "ProspectPipelineStep" AS ENUM ('INTAKE', 'NORMALIZE', 'VALIDATE', 'ENRICH', 'DEDUPLICATE', 'SCORE', 'ROUTE', 'ACTIVATE', 'HOLD', 'REJECT');
CREATE TYPE "ProspectStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVATED', 'DUPLICATE');
CREATE TYPE "DecisionOutcome" AS ENUM ('PASS', 'FAIL', 'REVIEW_REQUIRED', 'SKIP');
CREATE TYPE "MailboxType" AS ENUM ('PERSONAL', 'SHARED', 'CLIENT', 'CAMPAIGN');
CREATE TYPE "MailboxWarmupStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'PAUSED');
CREATE TYPE "MailboxSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SYNCED', 'ERROR');
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'FAILED');
CREATE TYPE "SequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'REPLIED', 'BOUNCED', 'UNSUBSCRIBED', 'MANUAL_EXIT');
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'ACTIVE');
CREATE TYPE "ScheduleBlockStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CommsChannelType" AS ENUM ('MISSION', 'CLIENT', 'CAMPAIGN', 'GROUP', 'DIRECT', 'BROADCAST');
CREATE TYPE "CommsThreadStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "CommsMessageType" AS ENUM ('TEXT', 'SYSTEM', 'BROADCAST');

-- =============================================
-- 2. TABLES (dependency order)
-- =============================================

-- Client (no FK to other app tables)
CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "industry" TEXT,
  "logo" TEXT,
  "bookingUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- User (references Client)
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "clientId" TEXT,
  "clientOnboardingDismissedPermanently" BOOLEAN NOT NULL DEFAULT false,
  "googleDriveConnected" BOOLEAN NOT NULL DEFAULT false,
  "googleDriveTokens" JSONB,
  "googleDriveEmail" TEXT,
  "emailProvider" TEXT,
  "emailConnected" BOOLEAN NOT NULL DEFAULT false,
  "emailTokens" JSONB,
  "smtpHost" TEXT,
  "smtpPort" INTEGER,
  "smtpUser" TEXT,
  "smtpPassword" TEXT,
  "selectedMissionId" TEXT,
  "selectedListId" TEXT,
  "phone" TEXT,
  "timezone" TEXT DEFAULT 'Europe/Paris',
  "preferences" JSONB,
  "outboundPhoneNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CompanyIssuer, BillingClient (standalone)
CREATE TABLE "CompanyIssuer" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'France',
  "siret" TEXT NOT NULL,
  "vatNumber" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "logo" TEXT,
  "legalForm" TEXT,
  "capitalSocial" TEXT,
  "rcsCity" TEXT,
  "rcsNumber" TEXT,
  "iban" TEXT,
  "bic" TEXT,
  "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "defaultLatePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "defaultEarlyPaymentDiscount" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyIssuer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingClient" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'France',
  "siret" TEXT,
  "vatNumber" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- ClientOnboarding, BusinessDeveloperClient
CREATE TABLE "ClientOnboarding" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
  "onboardingData" JSONB,
  "targetLaunchDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "scripts" JSONB,
  "notes" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessDeveloperClient" (
  "id" TEXT NOT NULL,
  "bdUserId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "BusinessDeveloperClient_pkey" PRIMARY KEY ("id")
);

-- Mission
CREATE TABLE "Mission" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "channel" "Channel" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "teamLeadSdrId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- Folder (self-ref + Mission, Client)
CREATE TABLE "Folder" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "missionId" TEXT,
  "clientId" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- List, Campaign, SDRAssignment
CREATE TABLE "List" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ListType" NOT NULL,
  "source" TEXT,
  "importConfig" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "List_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icp" TEXT NOT NULL,
  "pitch" TEXT NOT NULL,
  "script" TEXT,
  "rules" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SDRAssignment" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "sdrId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SDRAssignment_pkey" PRIMARY KEY ("id")
);

-- Company, Contact
CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "listId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "industry" TEXT,
  "website" TEXT,
  "size" TEXT,
  "phone" TEXT,
  "customData" JSONB,
  "status" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contact" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "title" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "additionalPhones" JSONB,
  "additionalEmails" JSONB,
  "linkedin" TEXT,
  "customData" JSONB,
  "status" "CompletenessStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "unsubscribed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- Action, ActionStatusDefinition, ActionNextStep
CREATE TABLE "Action" (
  "id" TEXT NOT NULL,
  "contactId" TEXT,
  "companyId" TEXT,
  "sdrId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "channel" "Channel" NOT NULL,
  "result" "ActionResult" NOT NULL,
  "note" TEXT,
  "callbackDate" TIMESTAMP(3),
  "duration" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionStatusDefinition" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionStatusDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionNextStep" (
  "id" TEXT NOT NULL,
  "scopeType" "ActionScopeType" NOT NULL,
  "scopeId" TEXT,
  "fromResultCode" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "label" TEXT,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionNextStep_pkey" PRIMARY KEY ("id")
);

-- Call
CREATE TABLE "Call" (
  "id" TEXT NOT NULL,
  "direction" "CallDirection" NOT NULL,
  "fromNumber" TEXT NOT NULL,
  "toNumber" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "contactId" TEXT,
  "companyId" TEXT,
  "campaignId" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP(3),
  "status" "CallStatus" NOT NULL DEFAULT 'queued',
  "durationSeconds" INTEGER,
  "recordingUrl" TEXT,
  "externalCallId" TEXT,
  "actionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- Opportunity
CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL,
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
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- File
CREATE TABLE "File" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "url" TEXT,
  "folderId" TEXT,
  "uploadedById" TEXT NOT NULL,
  "missionId" TEXT,
  "clientId" TEXT,
  "campaignId" TEXT,
  "taskId" TEXT,
  "description" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- GoogleDriveSync
CREATE TABLE "GoogleDriveSync" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "crmFolderId" TEXT,
  "driveFolderId" TEXT NOT NULL,
  "driveFolderName" TEXT NOT NULL,
  "driveFolderPath" TEXT,
  "syncDirection" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
  "autoSync" BOOLEAN NOT NULL DEFAULT false,
  "syncInterval" INTEGER NOT NULL DEFAULT 3600,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "filesSync" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleDriveSync_pkey" PRIMARY KEY ("id")
);

-- Project, ProjectMember, ProjectMilestone
CREATE TABLE "Project" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerId" TEXT NOT NULL,
  "clientId" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "color" TEXT DEFAULT '#6366f1',
  "icon" TEXT DEFAULT 'folder',
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- Task, TaskComment, TaskDependency, ProjectActivity, TaskTimeEntry, ProjectTemplate
CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueDate" TIMESTAMP(3),
  "startDate" TIMESTAMP(3),
  "assigneeId" TEXT,
  "createdById" TEXT NOT NULL,
  "estimatedHours" DOUBLE PRECISION,
  "loggedHours" DOUBLE PRECISION,
  "position" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "parentTaskId" TEXT,
  "milestoneId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskComment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskDependency" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "dependsOnTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectActivity" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "taskId" TEXT,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskTimeEntry" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "description" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "structure" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- ScheduleBlock, CrmActivityDay
CREATE TABLE "ScheduleBlock" (
  "id" TEXT NOT NULL,
  "sdrId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "notes" TEXT,
  "status" "ScheduleBlockStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmActivityDay" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "totalActiveSeconds" INTEGER NOT NULL DEFAULT 0,
  "currentSessionStartedAt" TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3),
  "sessionCount" INTEGER NOT NULL DEFAULT 0,
  "longestSessionSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmActivityDay_pkey" PRIMARY KEY ("id")
);

-- EmailAccount, Notification, RolePermission, UserPermission
CREATE TABLE "EmailAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "EmailProvider" NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiry" TIMESTAMP(3),
  "smtpHost" TEXT,
  "smtpPort" INTEGER,
  "imapHost" TEXT,
  "imapPort" INTEGER,
  "password" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "syncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "link" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissionId" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- Mailbox, MailboxPermission
CREATE TABLE "Mailbox" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "ownerId" TEXT NOT NULL,
  "provider" "EmailProvider" NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiry" TIMESTAMP(3),
  "imapHost" TEXT,
  "imapPort" INTEGER,
  "smtpHost" TEXT,
  "smtpPort" INTEGER,
  "password" TEXT,
  "type" "MailboxType" NOT NULL DEFAULT 'PERSONAL',
  "syncStatus" "MailboxSyncStatus" NOT NULL DEFAULT 'PENDING',
  "warmupStatus" "MailboxWarmupStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "warmupDailyLimit" INTEGER NOT NULL DEFAULT 20,
  "dailySendLimit" INTEGER NOT NULL DEFAULT 200,
  "sentToday" INTEGER NOT NULL DEFAULT 0,
  "lastSendReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signature" TEXT,
  "signatureHtml" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "healthScore" INTEGER NOT NULL DEFAULT 100,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "lastFailureAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "disabledReason" TEXT,
  "providerProfile" TEXT,
  "syncIntervalMs" INTEGER NOT NULL DEFAULT 300000,
  "trackingDomain" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MailboxPermission" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canRead" BOOLEAN NOT NULL DEFAULT true,
  "canSend" BOOLEAN NOT NULL DEFAULT false,
  "canSendAs" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailboxPermission_pkey" PRIMARY KEY ("id")
);

-- EmailTemplate
CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "bodyText" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- EmailThread, Email, EmailAttachment, ThreadComment
CREATE TABLE "EmailThread" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "snippet" TEXT,
  "participantEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "isStarred" BOOLEAN NOT NULL DEFAULT false,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "isTrashed" BOOLEAN NOT NULL DEFAULT false,
  "clientId" TEXT,
  "missionId" TEXT,
  "campaignId" TEXT,
  "opportunityId" TEXT,
  "contactId" TEXT,
  "assignedToId" TEXT,
  "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "slaDeadline" TIMESTAMP(3),
  "sentiment" TEXT,
  "priority" TEXT,
  "summary" TEXT,
  "providerThreadId" TEXT,
  "lastEmailAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Email" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "fromAddress" TEXT NOT NULL,
  "fromName" TEXT,
  "toAddresses" TEXT[] NOT NULL,
  "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "replyTo" TEXT,
  "subject" TEXT NOT NULL,
  "bodyText" TEXT,
  "bodyHtml" TEXT,
  "snippet" TEXT,
  "direction" "EmailDirection" NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',
  "trackingPixelId" TEXT,
  "openCount" INTEGER NOT NULL DEFAULT 0,
  "clickCount" INTEGER NOT NULL DEFAULT 0,
  "firstOpenedAt" TIMESTAMP(3),
  "lastOpenedAt" TIMESTAMP(3),
  "sequenceStepId" TEXT,
  "sequenceEnrollmentId" TEXT,
  "contactId" TEXT,
  "missionId" TEXT,
  "sentById" TEXT,
  "templateId" TEXT,
  "providerMessageId" TEXT,
  "providerThreadId" TEXT,
  "errorMessage" TEXT,
  "bounceType" TEXT,
  "sentAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAttachment" (
  "id" TEXT NOT NULL,
  "emailId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageKey" TEXT,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadComment" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadComment_pkey" PRIMARY KEY ("id")
);

-- EmailSequence, EmailSequenceStep, EmailSequenceEnrollment
CREATE TABLE "EmailSequence" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "SequenceStatus" NOT NULL DEFAULT 'DRAFT',
  "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
  "stopOnBounce" BOOLEAN NOT NULL DEFAULT true,
  "trackOpens" BOOLEAN NOT NULL DEFAULT true,
  "trackClicks" BOOLEAN NOT NULL DEFAULT true,
  "sendOnWeekends" BOOLEAN NOT NULL DEFAULT false,
  "sendTimeStart" TEXT,
  "sendTimeEnd" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
  "campaignId" TEXT,
  "totalEnrolled" INTEGER NOT NULL DEFAULT 0,
  "totalCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalReplied" INTEGER NOT NULL DEFAULT 0,
  "totalBounced" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSequenceStep" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "name" TEXT,
  "delayDays" INTEGER NOT NULL DEFAULT 0,
  "delayHours" INTEGER NOT NULL DEFAULT 0,
  "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  "bodyText" TEXT,
  "isABTest" BOOLEAN NOT NULL DEFAULT false,
  "variantSubjectB" TEXT,
  "variantBodyHtmlB" TEXT,
  "abWinnerCriteria" TEXT,
  "abTestEndDate" TIMESTAMP(3),
  "skipIfOpened" BOOLEAN NOT NULL DEFAULT false,
  "skipIfClicked" BOOLEAN NOT NULL DEFAULT false,
  "skipIfReplied" BOOLEAN NOT NULL DEFAULT true,
  "totalSent" INTEGER NOT NULL DEFAULT 0,
  "totalOpened" INTEGER NOT NULL DEFAULT 0,
  "totalClicked" INTEGER NOT NULL DEFAULT 0,
  "totalReplied" INTEGER NOT NULL DEFAULT 0,
  "totalBounced" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequenceStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailSequenceEnrollment" (
  "id" TEXT NOT NULL,
  "sequenceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "tokens" JSONB,
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextStepAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "exitedAt" TIMESTAMP(3),
  "exitReason" TEXT,
  "abVariant" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- EmailAnalyticsDaily, EmailAuditLog, MissionEmailTemplate
CREATE TABLE "EmailAnalyticsDaily" (
  "id" TEXT NOT NULL,
  "mailboxId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "delivered" INTEGER NOT NULL DEFAULT 0,
  "opened" INTEGER NOT NULL DEFAULT 0,
  "uniqueOpened" INTEGER NOT NULL DEFAULT 0,
  "clicked" INTEGER NOT NULL DEFAULT 0,
  "replied" INTEGER NOT NULL DEFAULT 0,
  "bounced" INTEGER NOT NULL DEFAULT 0,
  "avgResponseTime" INTEGER,
  "totalResponseTime" INTEGER NOT NULL DEFAULT 0,
  "responseCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAnalyticsDaily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailAuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionEmailTemplate" (
  "id" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CommsGroup, CommsGroupMember, CommsChannel, CommsThread, CommsParticipant
CREATE TABLE "CommsGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdById" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsChannel" (
  "id" TEXT NOT NULL,
  "type" "CommsChannelType" NOT NULL,
  "name" TEXT,
  "missionId" TEXT,
  "clientId" TEXT,
  "campaignId" TEXT,
  "groupId" TEXT,
  "directUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsChannel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsThread" (
  "id" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "CommsThreadStatus" NOT NULL DEFAULT 'OPEN',
  "createdById" TEXT NOT NULL,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "lastMessageAt" TIMESTAMP(3),
  "lastMessageById" TEXT,
  "isBroadcast" BOOLEAN NOT NULL DEFAULT false,
  "broadcastAudience" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsParticipant" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "isMuted" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsParticipant_pkey" PRIMARY KEY ("id")
);

-- CommsMessage, CommsMention, CommsAttachment, CommsMessageReadReceipt, CommsMessageReaction, CommsBroadcastReceipt
CREATE TABLE "CommsMessage" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentMessageId" TEXT,
  "type" "CommsMessageType" NOT NULL DEFAULT 'TEXT',
  "content" TEXT NOT NULL,
  "isEdited" BOOLEAN NOT NULL DEFAULT false,
  "editedAt" TIMESTAMP(3),
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsMention" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsMessageReadReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsMessageReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  CONSTRAINT "CommsMessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsBroadcastReceipt" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsBroadcastReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsSavedSearch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsSavedSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommsMessageTemplate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "content" TEXT NOT NULL,
  "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommsMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- Invoice, InvoiceItem, InvoicePayment, InvoiceAuditLog
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "documentType" "InvoiceDocumentType" NOT NULL DEFAULT 'INVOICE',
  "billingClientId" TEXT NOT NULL,
  "companyIssuerId" TEXT NOT NULL,
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "totalHt" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalVat" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalTtc" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
  "paymentTermsText" TEXT,
  "latePenaltyRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "earlyPaymentDiscount" TEXT,
  "notes" TEXT,
  "facturxPdfUrl" TEXT,
  "transactionType" "InvoiceTransactionType" NOT NULL DEFAULT 'B2B_DOMESTIC',
  "pdpSubmissionStatus" "PdpSubmissionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "pdpSubmissionId" TEXT,
  "pdpSubmittedAt" TIMESTAMP(3),
  "pdpResponseData" JSONB,
  "relatedInvoiceId" TEXT,
  "createdById" TEXT NOT NULL,
  "validatedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unitPriceHt" DECIMAL(10,2) NOT NULL,
  "vatRate" DECIMAL(5,2) NOT NULL,
  "totalHt" DECIMAL(10,2) NOT NULL,
  "totalVat" DECIMAL(10,2) NOT NULL,
  "totalTtc" DECIMAL(10,2) NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "qontoTransactionId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "status" "PaymentMatchStatus" NOT NULL DEFAULT 'MATCHED',
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceAuditLog" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAuditLog_pkey" PRIMARY KEY ("id")
);

-- ProspectSource, ProspectEvent, ProspectProfile, ProspectDecisionLog, ProspectRule, ProspectPipelineConfig
CREATE TABLE "ProspectSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ProspectSourceType" NOT NULL,
  "clientId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "autoActivate" BOOLEAN NOT NULL DEFAULT false,
  "defaultMissionId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectEvent" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "profileId" TEXT,
  "rawPayload" JSONB NOT NULL,
  "eventType" TEXT NOT NULL,
  "step" "ProspectPipelineStep" NOT NULL,
  "outcome" "DecisionOutcome",
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedBy" TEXT,
  "errorMessage" TEXT,
  "decisionLogId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectProfile" (
  "id" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "linkedin" TEXT,
  "title" TEXT,
  "companyName" TEXT,
  "companyWebsite" TEXT,
  "companyIndustry" TEXT,
  "companyCountry" TEXT,
  "companySize" TEXT,
  "customFields" JSONB,
  "currentStep" "ProspectPipelineStep" NOT NULL DEFAULT 'INTAKE',
  "status" "ProspectStatus" NOT NULL DEFAULT 'PENDING',
  "qualityScore" INTEGER NOT NULL DEFAULT 0,
  "confidenceScore" INTEGER NOT NULL DEFAULT 0,
  "assignedMissionId" TEXT,
  "assignedSdrId" TEXT,
  "duplicateOfId" TEXT,
  "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "reviewReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "activatedAt" TIMESTAMP(3),
  "activatedContactId" TEXT,
  "activatedCompanyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectDecisionLog" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "step" "ProspectPipelineStep" NOT NULL,
  "outcome" "DecisionOutcome" NOT NULL,
  "ruleId" TEXT,
  "ruleResult" JSONB,
  "inputData" JSONB NOT NULL,
  "outputData" JSONB,
  "reason" TEXT NOT NULL,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedBy" TEXT,
  CONSTRAINT "ProspectDecisionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectRule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "clientId" TEXT,
  "sourceId" TEXT,
  "step" "ProspectPipelineStep" NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "condition" JSONB NOT NULL,
  "action" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProspectPipelineConfig" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "enableEnrichment" BOOLEAN NOT NULL DEFAULT false,
  "enrichmentProvider" TEXT,
  "enrichmentApiKey" TEXT,
  "minQualityScore" INTEGER NOT NULL DEFAULT 50,
  "minConfidenceScore" INTEGER NOT NULL DEFAULT 70,
  "reviewThreshold" INTEGER NOT NULL DEFAULT 40,
  "enableDeduplication" BOOLEAN NOT NULL DEFAULT true,
  "dedupeFields" TEXT[] DEFAULT ARRAY['email', 'phone']::TEXT[],
  "defaultRoutingStrategy" TEXT NOT NULL DEFAULT 'round_robin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectPipelineConfig_pkey" PRIMARY KEY ("id")
);

-- =============================================
-- 3. UNIQUE CONSTRAINTS
-- =============================================

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_outboundPhoneNumber_key" ON "User"("outboundPhoneNumber");
CREATE UNIQUE INDEX "CompanyIssuer_siret_key" ON "CompanyIssuer"("siret");
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE UNIQUE INDEX "ClientOnboarding_clientId_key" ON "ClientOnboarding"("clientId");
CREATE UNIQUE INDEX "BusinessDeveloperClient_bdUserId_clientId_key" ON "BusinessDeveloperClient"("bdUserId", "clientId");
CREATE UNIQUE INDEX "SDRAssignment_missionId_sdrId_key" ON "SDRAssignment"("missionId", "sdrId");
CREATE UNIQUE INDEX "ActionStatusDefinition_scopeType_scopeId_code_key" ON "ActionStatusDefinition"("scopeType", "scopeId", "code");
CREATE UNIQUE INDEX "Call_actionId_key" ON "Call"("actionId");
CREATE UNIQUE INDEX "CrmActivityDay_userId_date_key" ON "CrmActivityDay"("userId", "date");
CREATE UNIQUE INDEX "EmailAccount_userId_email_key" ON "EmailAccount"("userId", "email");
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");
CREATE UNIQUE INDEX "Mailbox_ownerId_email_key" ON "Mailbox"("ownerId", "email");
CREATE UNIQUE INDEX "MailboxPermission_mailboxId_userId_key" ON "MailboxPermission"("mailboxId", "userId");
CREATE UNIQUE INDEX "Email_trackingPixelId_key" ON "Email"("trackingPixelId");
CREATE UNIQUE INDEX "Email_mailboxId_providerMessageId_key" ON "Email"("mailboxId", "providerMessageId");
CREATE UNIQUE INDEX "EmailSequenceStep_sequenceId_order_key" ON "EmailSequenceStep"("sequenceId", "order");
CREATE UNIQUE INDEX "EmailSequenceEnrollment_sequenceId_contactId_key" ON "EmailSequenceEnrollment"("sequenceId", "contactId");
CREATE UNIQUE INDEX "EmailAnalyticsDaily_mailboxId_date_key" ON "EmailAnalyticsDaily"("mailboxId", "date");
CREATE UNIQUE INDEX "MissionEmailTemplate_missionId_templateId_key" ON "MissionEmailTemplate"("missionId", "templateId");
CREATE UNIQUE INDEX "CommsChannel_missionId_key" ON "CommsChannel"("missionId");
CREATE UNIQUE INDEX "CommsChannel_clientId_key" ON "CommsChannel"("clientId");
CREATE UNIQUE INDEX "CommsChannel_campaignId_key" ON "CommsChannel"("campaignId");
CREATE UNIQUE INDEX "CommsChannel_groupId_key" ON "CommsChannel"("groupId");
CREATE UNIQUE INDEX "CommsGroupMember_groupId_userId_key" ON "CommsGroupMember"("groupId", "userId");
CREATE UNIQUE INDEX "CommsParticipant_threadId_userId_key" ON "CommsParticipant"("threadId", "userId");
CREATE UNIQUE INDEX "CommsMention_messageId_userId_key" ON "CommsMention"("messageId", "userId");
CREATE UNIQUE INDEX "CommsMessageReadReceipt_messageId_userId_key" ON "CommsMessageReadReceipt"("messageId", "userId");
CREATE UNIQUE INDEX "CommsMessageReaction_messageId_userId_emoji_key" ON "CommsMessageReaction"("messageId", "userId", "emoji");
CREATE UNIQUE INDEX "CommsBroadcastReceipt_threadId_userId_key" ON "CommsBroadcastReceipt"("threadId", "userId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "InvoicePayment_qontoTransactionId_key" ON "InvoicePayment"("qontoTransactionId");
CREATE UNIQUE INDEX "ProspectProfile_email_key" ON "ProspectProfile"("email");
CREATE UNIQUE INDEX "ProspectPipelineConfig_clientId_key" ON "ProspectPipelineConfig"("clientId");
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "TaskDependency"("taskId", "dependsOnTaskId");
CREATE UNIQUE INDEX "ScheduleBlock_sdrId_date_startTime_key" ON "ScheduleBlock"("sdrId", "date", "startTime");

-- =============================================
-- 4. FOREIGN KEYS
-- =============================================

ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDeveloperClient" ADD CONSTRAINT "BusinessDeveloperClient_bdUserId_fkey" FOREIGN KEY ("bdUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessDeveloperClient" ADD CONSTRAINT "BusinessDeveloperClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_teamLeadSdrId_fkey" FOREIGN KEY ("teamLeadSdrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "List" ADD CONSTRAINT "List_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SDRAssignment" ADD CONSTRAINT "SDRAssignment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SDRAssignment" ADD CONSTRAINT "SDRAssignment_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Action" ADD CONSTRAINT "Action_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Call" ADD CONSTRAINT "Call_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GoogleDriveSync" ADD CONSTRAINT "GoogleDriveSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleDriveSync" ADD CONSTRAINT "GoogleDriveSync_crmFolderId_fkey" FOREIGN KEY ("crmFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTimeEntry" ADD CONSTRAINT "TaskTimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectTemplate" ADD CONSTRAINT "ProjectTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_sdrId_fkey" FOREIGN KEY ("sdrId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmActivityDay" ADD CONSTRAINT "CrmActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxPermission" ADD CONSTRAINT "MailboxPermission_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxPermission" ADD CONSTRAINT "MailboxPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_sequenceStepId_fkey" FOREIGN KEY ("sequenceStepId") REFERENCES "EmailSequenceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_sequenceEnrollmentId_fkey" FOREIGN KEY ("sequenceEnrollmentId") REFERENCES "EmailSequenceEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Email" ADD CONSTRAINT "Email_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThreadComment" ADD CONSTRAINT "ThreadComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThreadComment" ADD CONSTRAINT "ThreadComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailSequence" ADD CONSTRAINT "EmailSequence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmailSequenceStep" ADD CONSTRAINT "EmailSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSequenceEnrollment" ADD CONSTRAINT "EmailSequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "EmailSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailSequenceEnrollment" ADD CONSTRAINT "EmailSequenceEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailAnalyticsDaily" ADD CONSTRAINT "EmailAnalyticsDaily_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailAuditLog" ADD CONSTRAINT "EmailAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionEmailTemplate" ADD CONSTRAINT "MissionEmailTemplate_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionEmailTemplate" ADD CONSTRAINT "MissionEmailTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsGroup" ADD CONSTRAINT "CommsGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommsGroupMember" ADD CONSTRAINT "CommsGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsGroupMember" ADD CONSTRAINT "CommsGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsChannel" ADD CONSTRAINT "CommsChannel_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsChannel" ADD CONSTRAINT "CommsChannel_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsChannel" ADD CONSTRAINT "CommsChannel_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsChannel" ADD CONSTRAINT "CommsChannel_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsThread" ADD CONSTRAINT "CommsThread_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommsChannel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsThread" ADD CONSTRAINT "CommsThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommsParticipant" ADD CONSTRAINT "CommsParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommsThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsParticipant" ADD CONSTRAINT "CommsParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessage" ADD CONSTRAINT "CommsMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommsThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessage" ADD CONSTRAINT "CommsMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommsMessage" ADD CONSTRAINT "CommsMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "CommsMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommsMention" ADD CONSTRAINT "CommsMention_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMention" ADD CONSTRAINT "CommsMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsAttachment" ADD CONSTRAINT "CommsAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessageReadReceipt" ADD CONSTRAINT "CommsMessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessageReadReceipt" ADD CONSTRAINT "CommsMessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessageReaction" ADD CONSTRAINT "CommsMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsMessageReaction" ADD CONSTRAINT "CommsMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsBroadcastReceipt" ADD CONSTRAINT "CommsBroadcastReceipt_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommsThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsBroadcastReceipt" ADD CONSTRAINT "CommsBroadcastReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommsSavedSearch" ADD CONSTRAINT "CommsSavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingClientId_fkey" FOREIGN KEY ("billingClientId") REFERENCES "BillingClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyIssuerId_fkey" FOREIGN KEY ("companyIssuerId") REFERENCES "CompanyIssuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey" FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAuditLog" ADD CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProspectSource" ADD CONSTRAINT "ProspectSource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectSource" ADD CONSTRAINT "ProspectSource_defaultMissionId_fkey" FOREIGN KEY ("defaultMissionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectEvent" ADD CONSTRAINT "ProspectEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProspectSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectEvent" ADD CONSTRAINT "ProspectEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProspectProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectEvent" ADD CONSTRAINT "ProspectEvent_decisionLogId_fkey" FOREIGN KEY ("decisionLogId") REFERENCES "ProspectDecisionLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectProfile" ADD CONSTRAINT "ProspectProfile_assignedMissionId_fkey" FOREIGN KEY ("assignedMissionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectProfile" ADD CONSTRAINT "ProspectProfile_assignedSdrId_fkey" FOREIGN KEY ("assignedSdrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectProfile" ADD CONSTRAINT "ProspectProfile_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "ProspectProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectProfile" ADD CONSTRAINT "ProspectProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectDecisionLog" ADD CONSTRAINT "ProspectDecisionLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProspectProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProspectDecisionLog" ADD CONSTRAINT "ProspectDecisionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ProspectRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectRule" ADD CONSTRAINT "ProspectRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectRule" ADD CONSTRAINT "ProspectRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ProspectSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectRule" ADD CONSTRAINT "ProspectRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProspectRule" ADD CONSTRAINT "ProspectRule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectPipelineConfig" ADD CONSTRAINT "ProspectPipelineConfig_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ClientOnboarding createdById (User) - add after User exists
ALTER TABLE "ClientOnboarding" ADD CONSTRAINT "ClientOnboarding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- File taskId (Task) - add after Task exists
ALTER TABLE "File" ADD CONSTRAINT "File_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- 5. INDEXES (from @@index in schema)
-- =============================================

CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "BusinessDeveloperClient_bdUserId_idx" ON "BusinessDeveloperClient"("bdUserId");
CREATE INDEX "BusinessDeveloperClient_clientId_idx" ON "BusinessDeveloperClient"("clientId");
CREATE INDEX "ClientOnboarding_clientId_idx" ON "ClientOnboarding"("clientId");
CREATE INDEX "ClientOnboarding_status_idx" ON "ClientOnboarding"("status");
CREATE INDEX "Action_companyId_idx" ON "Action"("companyId");
CREATE INDEX "Action_contactId_idx" ON "Action"("contactId");
CREATE INDEX "Action_callbackDate_idx" ON "Action"("callbackDate");
CREATE INDEX "ActionStatusDefinition_scopeType_scopeId_idx" ON "ActionStatusDefinition"("scopeType", "scopeId");
CREATE INDEX "ActionNextStep_scopeType_scopeId_idx" ON "ActionNextStep"("scopeType", "scopeId");
CREATE INDEX "Call_userId_idx" ON "Call"("userId");
CREATE INDEX "Call_startTime_idx" ON "Call"("startTime");
CREATE INDEX "Call_status_idx" ON "Call"("status");
CREATE INDEX "Folder_parentId_idx" ON "Folder"("parentId");
CREATE INDEX "Folder_missionId_idx" ON "Folder"("missionId");
CREATE INDEX "Folder_clientId_idx" ON "Folder"("clientId");
CREATE INDEX "File_folderId_idx" ON "File"("folderId");
CREATE INDEX "File_uploadedById_idx" ON "File"("uploadedById");
CREATE INDEX "File_missionId_idx" ON "File"("missionId");
CREATE INDEX "File_clientId_idx" ON "File"("clientId");
CREATE INDEX "File_campaignId_idx" ON "File"("campaignId");
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");
CREATE INDEX "GoogleDriveSync_userId_idx" ON "GoogleDriveSync"("userId");
CREATE INDEX "GoogleDriveSync_crmFolderId_idx" ON "GoogleDriveSync"("crmFolderId");
CREATE INDEX "GoogleDriveSync_isActive_idx" ON "GoogleDriveSync"("isActive");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_priority_idx" ON "Task"("priority");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX "Task_position_idx" ON "Task"("position");
CREATE INDEX "Task_milestoneId_idx" ON "Task"("milestoneId");
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");
CREATE INDEX "TaskComment_userId_idx" ON "TaskComment"("userId");
CREATE INDEX "TaskDependency_taskId_idx" ON "TaskDependency"("taskId");
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "TaskDependency"("dependsOnTaskId");
CREATE INDEX "ProjectActivity_projectId_createdAt_idx" ON "ProjectActivity"("projectId", "createdAt");
CREATE INDEX "ProjectActivity_taskId_idx" ON "ProjectActivity"("taskId");
CREATE INDEX "ProjectActivity_userId_idx" ON "ProjectActivity"("userId");
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");
CREATE INDEX "TaskTimeEntry_taskId_idx" ON "TaskTimeEntry"("taskId");
CREATE INDEX "TaskTimeEntry_userId_idx" ON "TaskTimeEntry"("userId");
CREATE INDEX "TaskTimeEntry_date_idx" ON "TaskTimeEntry"("date");
CREATE INDEX "ScheduleBlock_sdrId_idx" ON "ScheduleBlock"("sdrId");
CREATE INDEX "ScheduleBlock_missionId_idx" ON "ScheduleBlock"("missionId");
CREATE INDEX "ScheduleBlock_date_idx" ON "ScheduleBlock"("date");
CREATE INDEX "ScheduleBlock_createdById_idx" ON "ScheduleBlock"("createdById");
CREATE INDEX "CrmActivityDay_userId_idx" ON "CrmActivityDay"("userId");
CREATE INDEX "CrmActivityDay_date_idx" ON "CrmActivityDay"("date");
CREATE INDEX "CrmActivityDay_date_totalActiveSeconds_idx" ON "CrmActivityDay"("date", "totalActiveSeconds");
CREATE INDEX "EmailAccount_userId_idx" ON "EmailAccount"("userId");
CREATE INDEX "EmailAccount_provider_idx" ON "EmailAccount"("provider");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Permission_category_idx" ON "Permission"("category");
CREATE INDEX "Permission_code_idx" ON "Permission"("code");
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");
CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
CREATE INDEX "Mailbox_organizationId_idx" ON "Mailbox"("organizationId");
CREATE INDEX "Mailbox_syncStatus_idx" ON "Mailbox"("syncStatus");
CREATE INDEX "Mailbox_type_idx" ON "Mailbox"("type");
CREATE INDEX "Mailbox_isActive_idx" ON "Mailbox"("isActive");
CREATE INDEX "MailboxPermission_mailboxId_idx" ON "MailboxPermission"("mailboxId");
CREATE INDEX "MailboxPermission_userId_idx" ON "MailboxPermission"("userId");
CREATE INDEX "EmailThread_mailboxId_idx" ON "EmailThread"("mailboxId");
CREATE INDEX "EmailThread_clientId_idx" ON "EmailThread"("clientId");
CREATE INDEX "EmailThread_missionId_idx" ON "EmailThread"("missionId");
CREATE INDEX "EmailThread_campaignId_idx" ON "EmailThread"("campaignId");
CREATE INDEX "EmailThread_contactId_idx" ON "EmailThread"("contactId");
CREATE INDEX "EmailThread_assignedToId_idx" ON "EmailThread"("assignedToId");
CREATE INDEX "EmailThread_isRead_isArchived_idx" ON "EmailThread"("isRead", "isArchived");
CREATE INDEX "EmailThread_lastEmailAt_idx" ON "EmailThread"("lastEmailAt");
CREATE INDEX "EmailThread_providerThreadId_idx" ON "EmailThread"("providerThreadId");
CREATE INDEX "Email_mailboxId_idx" ON "Email"("mailboxId");
CREATE INDEX "Email_threadId_idx" ON "Email"("threadId");
CREATE INDEX "Email_status_idx" ON "Email"("status");
CREATE INDEX "Email_direction_idx" ON "Email"("direction");
CREATE INDEX "Email_sentAt_idx" ON "Email"("sentAt");
CREATE INDEX "Email_receivedAt_idx" ON "Email"("receivedAt");
CREATE INDEX "Email_providerMessageId_idx" ON "Email"("providerMessageId");
CREATE INDEX "Email_sequenceEnrollmentId_idx" ON "Email"("sequenceEnrollmentId");
CREATE INDEX "Email_contactId_idx" ON "Email"("contactId");
CREATE INDEX "Email_missionId_idx" ON "Email"("missionId");
CREATE INDEX "Email_sentById_idx" ON "Email"("sentById");
CREATE INDEX "EmailAttachment_emailId_idx" ON "EmailAttachment"("emailId");
CREATE INDEX "ThreadComment_threadId_idx" ON "ThreadComment"("threadId");
CREATE INDEX "ThreadComment_userId_idx" ON "ThreadComment"("userId");
CREATE INDEX "EmailSequence_mailboxId_idx" ON "EmailSequence"("mailboxId");
CREATE INDEX "EmailSequence_campaignId_idx" ON "EmailSequence"("campaignId");
CREATE INDEX "EmailSequence_status_idx" ON "EmailSequence"("status");
CREATE INDEX "EmailSequence_createdById_idx" ON "EmailSequence"("createdById");
CREATE INDEX "EmailSequenceStep_sequenceId_idx" ON "EmailSequenceStep"("sequenceId");
CREATE INDEX "EmailSequenceEnrollment_sequenceId_idx" ON "EmailSequenceEnrollment"("sequenceId");
CREATE INDEX "EmailSequenceEnrollment_contactId_idx" ON "EmailSequenceEnrollment"("contactId");
CREATE INDEX "EmailSequenceEnrollment_status_idx" ON "EmailSequenceEnrollment"("status");
CREATE INDEX "EmailSequenceEnrollment_nextStepAt_idx" ON "EmailSequenceEnrollment"("nextStepAt");
CREATE INDEX "EmailAnalyticsDaily_mailboxId_idx" ON "EmailAnalyticsDaily"("mailboxId");
CREATE INDEX "EmailAnalyticsDaily_date_idx" ON "EmailAnalyticsDaily"("date");
CREATE INDEX "EmailAuditLog_userId_idx" ON "EmailAuditLog"("userId");
CREATE INDEX "EmailAuditLog_resourceType_resourceId_idx" ON "EmailAuditLog"("resourceType", "resourceId");
CREATE INDEX "EmailAuditLog_createdAt_idx" ON "EmailAuditLog"("createdAt");
CREATE INDEX "EmailAuditLog_action_idx" ON "EmailAuditLog"("action");
CREATE INDEX "EmailTemplate_createdById_idx" ON "EmailTemplate"("createdById");
CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");
CREATE INDEX "EmailTemplate_isShared_idx" ON "EmailTemplate"("isShared");
CREATE INDEX "MissionEmailTemplate_missionId_idx" ON "MissionEmailTemplate"("missionId");
CREATE INDEX "MissionEmailTemplate_templateId_idx" ON "MissionEmailTemplate"("templateId");
CREATE INDEX "CommsGroup_createdById_idx" ON "CommsGroup"("createdById");
CREATE INDEX "CommsGroup_isActive_idx" ON "CommsGroup"("isActive");
CREATE INDEX "CommsGroupMember_groupId_idx" ON "CommsGroupMember"("groupId");
CREATE INDEX "CommsGroupMember_userId_idx" ON "CommsGroupMember"("userId");
CREATE INDEX "CommsChannel_type_idx" ON "CommsChannel"("type");
CREATE INDEX "CommsThread_channelId_idx" ON "CommsThread"("channelId");
CREATE INDEX "CommsThread_createdById_idx" ON "CommsThread"("createdById");
CREATE INDEX "CommsThread_status_idx" ON "CommsThread"("status");
CREATE INDEX "CommsThread_lastMessageAt_idx" ON "CommsThread"("lastMessageAt");
CREATE INDEX "CommsThread_isBroadcast_idx" ON "CommsThread"("isBroadcast");
CREATE INDEX "CommsParticipant_threadId_idx" ON "CommsParticipant"("threadId");
CREATE INDEX "CommsParticipant_userId_idx" ON "CommsParticipant"("userId");
CREATE INDEX "CommsParticipant_unreadCount_idx" ON "CommsParticipant"("unreadCount");
CREATE INDEX "CommsMessage_threadId_idx" ON "CommsMessage"("threadId");
CREATE INDEX "CommsMessage_authorId_idx" ON "CommsMessage"("authorId");
CREATE INDEX "CommsMessage_parentMessageId_idx" ON "CommsMessage"("parentMessageId");
CREATE INDEX "CommsMessage_createdAt_idx" ON "CommsMessage"("createdAt");
CREATE INDEX "CommsMessage_isDeleted_idx" ON "CommsMessage"("isDeleted");
CREATE INDEX "CommsMention_messageId_idx" ON "CommsMention"("messageId");
CREATE INDEX "CommsMention_userId_idx" ON "CommsMention"("userId");
CREATE INDEX "CommsMention_notified_idx" ON "CommsMention"("notified");
CREATE INDEX "CommsAttachment_messageId_idx" ON "CommsAttachment"("messageId");
CREATE INDEX "CommsMessageReadReceipt_messageId_idx" ON "CommsMessageReadReceipt"("messageId");
CREATE INDEX "CommsMessageReadReceipt_userId_idx" ON "CommsMessageReadReceipt"("userId");
CREATE INDEX "CommsMessageReaction_messageId_idx" ON "CommsMessageReaction"("messageId");
CREATE INDEX "CommsMessageReaction_userId_idx" ON "CommsMessageReaction"("userId");
CREATE INDEX "CommsBroadcastReceipt_threadId_idx" ON "CommsBroadcastReceipt"("threadId");
CREATE INDEX "CommsBroadcastReceipt_userId_idx" ON "CommsBroadcastReceipt"("userId");
CREATE INDEX "CommsSavedSearch_userId_idx" ON "CommsSavedSearch"("userId");
CREATE INDEX "CommsMessageTemplate_userId_idx" ON "CommsMessageTemplate"("userId");
CREATE INDEX "CommsMessageTemplate_isShared_idx" ON "CommsMessageTemplate"("isShared");
CREATE INDEX "CommsMessageTemplate_category_idx" ON "CommsMessageTemplate"("category");
CREATE INDEX "BillingClient_siret_idx" ON "BillingClient"("siret");
CREATE INDEX "BillingClient_vatNumber_idx" ON "BillingClient"("vatNumber");
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_documentType_idx" ON "Invoice"("documentType");
CREATE INDEX "Invoice_billingClientId_idx" ON "Invoice"("billingClientId");
CREATE INDEX "Invoice_companyIssuerId_idx" ON "Invoice"("companyIssuerId");
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");
CREATE INDEX "Invoice_relatedInvoiceId_idx" ON "Invoice"("relatedInvoiceId");
CREATE INDEX "Invoice_transactionType_idx" ON "Invoice"("transactionType");
CREATE INDEX "Invoice_pdpSubmissionStatus_idx" ON "Invoice"("pdpSubmissionStatus");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoicePayment_invoiceId_idx" ON "InvoicePayment"("invoiceId");
CREATE INDEX "InvoicePayment_qontoTransactionId_idx" ON "InvoicePayment"("qontoTransactionId");
CREATE INDEX "InvoicePayment_status_idx" ON "InvoicePayment"("status");
CREATE INDEX "InvoiceAuditLog_invoiceId_idx" ON "InvoiceAuditLog"("invoiceId");
CREATE INDEX "InvoiceAuditLog_userId_idx" ON "InvoiceAuditLog"("userId");
CREATE INDEX "InvoiceAuditLog_action_idx" ON "InvoiceAuditLog"("action");
CREATE INDEX "ProspectSource_clientId_idx" ON "ProspectSource"("clientId");
CREATE INDEX "ProspectSource_type_idx" ON "ProspectSource"("type");
CREATE INDEX "ProspectSource_isActive_idx" ON "ProspectSource"("isActive");
CREATE INDEX "ProspectEvent_sourceId_idx" ON "ProspectEvent"("sourceId");
CREATE INDEX "ProspectEvent_profileId_idx" ON "ProspectEvent"("profileId");
CREATE INDEX "ProspectEvent_step_idx" ON "ProspectEvent"("step");
CREATE INDEX "ProspectEvent_createdAt_idx" ON "ProspectEvent"("createdAt");
CREATE INDEX "ProspectEvent_eventType_idx" ON "ProspectEvent"("eventType");
CREATE INDEX "ProspectProfile_status_idx" ON "ProspectProfile"("status");
CREATE INDEX "ProspectProfile_currentStep_idx" ON "ProspectProfile"("currentStep");
CREATE INDEX "ProspectProfile_qualityScore_idx" ON "ProspectProfile"("qualityScore");
CREATE INDEX "ProspectProfile_reviewRequired_idx" ON "ProspectProfile"("reviewRequired");
CREATE INDEX "ProspectProfile_assignedMissionId_idx" ON "ProspectProfile"("assignedMissionId");
CREATE INDEX "ProspectProfile_assignedSdrId_idx" ON "ProspectProfile"("assignedSdrId");
CREATE INDEX "ProspectProfile_email_idx" ON "ProspectProfile"("email");
CREATE INDEX "ProspectProfile_phone_idx" ON "ProspectProfile"("phone");
CREATE INDEX "ProspectDecisionLog_profileId_idx" ON "ProspectDecisionLog"("profileId");
CREATE INDEX "ProspectDecisionLog_step_idx" ON "ProspectDecisionLog"("step");
CREATE INDEX "ProspectDecisionLog_outcome_idx" ON "ProspectDecisionLog"("outcome");
CREATE INDEX "ProspectDecisionLog_executedAt_idx" ON "ProspectDecisionLog"("executedAt");
CREATE INDEX "ProspectRule_clientId_idx" ON "ProspectRule"("clientId");
CREATE INDEX "ProspectRule_sourceId_idx" ON "ProspectRule"("sourceId");
CREATE INDEX "ProspectRule_step_idx" ON "ProspectRule"("step");
CREATE INDEX "ProspectRule_isActive_idx" ON "ProspectRule"("isActive");
CREATE INDEX "ProspectRule_priority_idx" ON "ProspectRule"("priority");

-- =============================================
-- DONE. Run this script in Supabase SQL Editor.
-- For seed data, run seed-data.sql after this.
-- =============================================
