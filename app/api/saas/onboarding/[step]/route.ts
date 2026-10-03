import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, parseBody, requireSaasMember, saasHandler } from "@/lib/saas/account";
import { applyStep } from "@/lib/saas/onboarding-service";

const bodySchema = z.object({
    action: z.enum(["save", "complete", "skip"]),
    data: z.unknown().optional(),
});

export const PUT = saasHandler(async (request: NextRequest, { params }: { params: Promise<{ step: string }> }) => {
    const ctx = await requireSaasMember({ productAccess: true });
    const { step } = await params;
    const body = await parseBody(request, bodySchema);
    const result = await applyStep(ctx, step, body.action, body.data ?? {});
    return ok(result);
});
