import { NextRequest } from "next/server";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { autoEnrichAction } from "@/lib/call-enrichment/auto-enrichment";

export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  await requireRole(["SDR", "BUSINESS_DEVELOPER", "MANAGER"], request);
  const { id } = await params;
  const result = await autoEnrichAction(id);
  return successResponse(result);
});
