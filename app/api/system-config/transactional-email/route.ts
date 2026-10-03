import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
} from "@/lib/api-utils";
import { z } from "zod";

const CONFIG_KEY = "transactionalEmailFrom";

const updateTransactionalEmailSchema = z.object({
  from: z
    .string()
    .trim()
    .min(1, "L'adresse expéditeur est requise")
    .max(255, "L'adresse expéditeur est trop longue"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const record = await prisma.systemConfig.findUnique({
    where: { key: CONFIG_KEY },
    select: { value: true },
  });

  const fromFromSettings = record?.value?.trim() || "";
  const fromFromEnv = process.env.SYSTEM_SMTP_FROM?.trim() || "";
  const from = fromFromSettings || fromFromEnv;

  return successResponse({
    from,
    source: fromFromSettings ? "settings" : fromFromEnv ? "env" : "none",
  });
});

export const PUT = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  const body = await request.json();
  const parsed = updateTransactionalEmailSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 400);
  }

  await prisma.systemConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: parsed.data.from },
    create: { key: CONFIG_KEY, value: parsed.data.from },
  });

  return successResponse({ from: parsed.data.from, source: "settings" });
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  await requireRole(["MANAGER"], request);

  await prisma.systemConfig.deleteMany({ where: { key: CONFIG_KEY } });

  const fromFromEnv = process.env.SYSTEM_SMTP_FROM?.trim() || "";
  return successResponse({
    from: fromFromEnv,
    source: fromFromEnv ? "env" : "none",
  });
});
