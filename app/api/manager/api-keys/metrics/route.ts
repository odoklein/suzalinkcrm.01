import { NextRequest } from "next/server";
import { requireRole, successResponse, withErrorHandler } from "@/lib/api-utils";
import { getTodayExternalApiCallSummary } from "@/lib/api-request-metrics";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const summary = await getTodayExternalApiCallSummary();

  return successResponse(summary);
});
