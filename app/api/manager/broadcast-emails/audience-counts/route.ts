// GET /api/manager/broadcast-emails/audience-counts
// Returns the number of active clients, commercials and internal team members

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const [clients, commercials, internalTeam] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT", isActive: true } }),
    prisma.user.count({ where: { role: "COMMERCIAL", isActive: true } }),
    prisma.user.count({
      where: {
        isActive: true,
        role: { in: ["MANAGER", "SDR", "BOOKER", "DEVELOPER", "BUSINESS_DEVELOPER"] },
      },
    }),
  ]);

  return successResponse({ clients, commercials, internalTeam });
});
