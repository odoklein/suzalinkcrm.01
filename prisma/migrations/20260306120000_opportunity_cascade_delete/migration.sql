-- AlterTable: Opportunity - cascade delete when Company or Contact is deleted (fixes P2003 on client/mission delete)
ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_companyId_fkey";
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Opportunity" DROP CONSTRAINT IF EXISTS "Opportunity_contactId_fkey";
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: EmailThread - set opportunityId to null when Opportunity is deleted
ALTER TABLE "EmailThread" DROP CONSTRAINT IF EXISTS "EmailThread_opportunityId_fkey";
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
