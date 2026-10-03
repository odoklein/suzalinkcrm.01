-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastSignInAt" TIMESTAMP(3),
ADD COLUMN "lastSignInIp" TEXT,
ADD COLUMN "lastSignInCountry" TEXT,
ADD COLUMN "lastConnectedAt" TIMESTAMP(3);
