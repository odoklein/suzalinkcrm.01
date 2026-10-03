import { NextRequest } from "next/server";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";
import { statusConfigService } from "@/lib/services/StatusConfigService";

// ============================================
// GET /api/config/action-statuses
// Returns effective status definitions and next steps for the given scope.
// Query: campaignId=... OR missionId=... OR clientId=...
// Used by SDR action page and drawers to show allowed statuses with correct labels.
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["SDR", "MANAGER", "BUSINESS_DEVELOPER", "BOOKER"], request);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;
    const missionId = searchParams.get("missionId") || undefined;
    const clientId = searchParams.get("clientId") || undefined;

    // When no scope is provided, return GLOBAL statuses so SDRs always get
    // the config-driven statuses defined in the manager settings page.
    const config = await statusConfigService.getEffectiveStatusConfig({
        campaignId,
        missionId,
        clientId,
    });

    return successResponse(config);
});
