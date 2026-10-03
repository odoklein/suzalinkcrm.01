// GET /api/manager/broadcast-emails/selectable-users
// Returns all active users with an email for manual selection

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, requireRole, withErrorHandler } from "@/lib/api-utils";

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      email: { not: "" },
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return successResponse(users);
});
