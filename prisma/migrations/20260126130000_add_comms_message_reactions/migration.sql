-- CreateTable
CREATE TABLE "CommsMessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "CommsMessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommsMessageReaction_messageId_userId_emoji_key" ON "CommsMessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "CommsMessageReaction_messageId_idx" ON "CommsMessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "CommsMessageReaction_userId_idx" ON "CommsMessageReaction"("userId");

-- AddForeignKey
ALTER TABLE "CommsMessageReaction" ADD CONSTRAINT "CommsMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommsMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommsMessageReaction" ADD CONSTRAINT "CommsMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
