-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "teamLeadSdrId" TEXT;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_teamLeadSdrId_fkey" FOREIGN KEY ("teamLeadSdrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex for lookups by team lead
CREATE INDEX "Mission_teamLeadSdrId_idx" ON "Mission"("teamLeadSdrId");
