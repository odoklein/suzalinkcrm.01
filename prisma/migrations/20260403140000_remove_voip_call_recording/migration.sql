-- Remove VoIP / call recording stack (Allo, WithAllo, unified VoIP layer)

-- Child tables first
DROP TABLE IF EXISTS "CallTranscript" CASCADE;
DROP TABLE IF EXISTS "CallRecord" CASCADE;
DROP TABLE IF EXISTS "CallSession" CASCADE;
DROP TABLE IF EXISTS "UserVoipConfig" CASCADE;
DROP TABLE IF EXISTS "VoipWorkspaceConfig" CASCADE;

-- Action: drop VoIP unique index and columns
DROP INDEX IF EXISTS "Action_voipProvider_voipCallId_key";

ALTER TABLE "Action" DROP COLUMN IF EXISTS "actionStatus";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipProvider";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipCallId";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipRecordingUrl";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipSummary";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipTranscript";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipSentiment";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipTopics";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipActionItems";
ALTER TABLE "Action" DROP COLUMN IF EXISTS "voipEnrichedAt";

DROP TYPE IF EXISTS "ActionStatus";
