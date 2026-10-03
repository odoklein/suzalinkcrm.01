-- CreateTable: ResultCategory for grouping action statuses in reports and client portal (Activité)
CREATE TABLE "ResultCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResultCategory_code_key" ON "ResultCategory"("code");

-- AlterTable: Add resultCategoryCode to ActionStatusDefinition
ALTER TABLE "ActionStatusDefinition" ADD COLUMN "resultCategoryCode" TEXT;
