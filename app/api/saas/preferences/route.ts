import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, parseBody, requireSaasMember, saasHandler } from "@/lib/saas/account";

// Per-member adoption state: which tips were dismissed, whether the checklist is collapsed.
const prefsSchema = z.object({
    dismissedTips: z.array(z.string().max(60)).max(100).optional(),
    checklistCollapsed: z.boolean().optional(),
    welcomeSeen: z.boolean().optional(),
});

export const PATCH = saasHandler(async (request: NextRequest) => {
    const { member } = await requireSaasMember();
    const patch = await parseBody(request, prefsSchema);
    const current = (member.preferences && typeof member.preferences === "object" ? member.preferences : {}) as Record<string, unknown>;
    const next = { ...current, ...patch };
    if (patch.dismissedTips) {
        const prev = Array.isArray(current.dismissedTips) ? (current.dismissedTips as string[]) : [];
        next.dismissedTips = [...new Set([...prev, ...patch.dismissedTips])].slice(-100);
    }
    await prisma.saasMember.update({ where: { id: member.id }, data: { preferences: next as Prisma.InputJsonValue } });
    return ok(next);
});
