-- Run this on your database if you see: "The column User.outboundPhoneNumber does not exist"
-- (e.g. when Prisma migrate deploy was not used / baseline DB)

-- Add column and unique index for User.outboundPhoneNumber (call system)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "outboundPhoneNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_outboundPhoneNumber_key" ON "User"("outboundPhoneNumber");
