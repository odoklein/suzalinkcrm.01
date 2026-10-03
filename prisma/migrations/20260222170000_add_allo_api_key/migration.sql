-- AlterTable VoipWorkspaceConfig: add Allo API key (for webhook verification / Allo API calls)
ALTER TABLE "VoipWorkspaceConfig" ADD COLUMN "alloApiKey" TEXT;
