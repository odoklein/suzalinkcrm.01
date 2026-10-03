-- AlterTable
ALTER TABLE "CommsMessage" ADD COLUMN "parentMessageId" TEXT;

-- CreateIndex
CREATE INDEX "CommsMessage_parentMessageId_idx" ON "CommsMessage"("parentMessageId");

-- AddForeignKey
ALTER TABLE "CommsMessage" ADD CONSTRAINT "CommsMessage_parentMessageId_fkey" FOREIGN KEY ("parentMessageId") REFERENCES "CommsMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
