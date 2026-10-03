-- Add multi-channel support: Mission.channels (array of Channel)
-- Backfill: channels = ARRAY[channel] so existing missions keep their single channel
ALTER TABLE "Mission" ADD COLUMN "channels" "Channel"[] DEFAULT ARRAY['CALL']::"Channel"[];

UPDATE "Mission" SET "channels" = ARRAY["channel"]::"Channel"[];
