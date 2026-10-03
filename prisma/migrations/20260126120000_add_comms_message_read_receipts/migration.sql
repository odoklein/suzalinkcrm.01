-- CreateTable
CREATE TABLE "CommsMessageReadReceipt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommsMessageReadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommsMessageReadReceipt_messageId_userId_key" ON "CommsMessageReadReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "CommsMessageReadReceipt_messageId_idx" ON "CommsMessageReadReceipt"("messageId");

-- CreateIndex
CREATE INDEX "CommsMessageReadReceipt_userId_idx" ON "CommsMessageReadReceipt"("userId");

-- AddForeignKey
ALTER TABLE "CommsMessageReadReceipt" ADD CONSTRAINT "CommsMessageReadReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommsMessageReadReceipt" ADD CONSTRAINT "CommsMessageReadReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
