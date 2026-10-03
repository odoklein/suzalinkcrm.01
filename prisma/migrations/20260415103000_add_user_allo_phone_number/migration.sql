-- Add optional Allo phone number per user (used for WithAllo metrics).
ALTER TABLE "User"
ADD COLUMN "alloPhoneNumber" TEXT;
