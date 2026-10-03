-- CreateTable
CREATE TABLE "CrmActivityDay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalActiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "currentSessionStartedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivityDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmActivityDay_userId_date_key" ON "CrmActivityDay"("userId", "date");

-- CreateIndex
CREATE INDEX "CrmActivityDay_userId_idx" ON "CrmActivityDay"("userId");

-- CreateIndex
CREATE INDEX "CrmActivityDay_date_idx" ON "CrmActivityDay"("date");

-- AddForeignKey
ALTER TABLE "CrmActivityDay" ADD CONSTRAINT "CrmActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
