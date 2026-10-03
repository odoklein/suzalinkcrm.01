-- DropTable
DROP TABLE IF EXISTS "Call";

-- DropIndex
DROP INDEX IF EXISTS "User_outboundPhoneNumber_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "outboundPhoneNumber";

-- DropEnum
DROP TYPE IF EXISTS "CallStatus";

-- DropEnum
DROP TYPE IF EXISTS "CallDirection";
