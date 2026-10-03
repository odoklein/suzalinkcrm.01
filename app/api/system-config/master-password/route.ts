import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from "@/lib/api-utils";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CONFIG_KEY = "masterPasswordHash";

const setMasterPasswordSchema = z.object({
    password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
});

// GET /api/system-config/master-password — Returns enabled status (never the actual value)
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const record = await prisma.systemConfig.findUnique({
        where: { key: CONFIG_KEY },
    });

    return successResponse({ enabled: !!record?.value?.trim() });
});

// PUT /api/system-config/master-password — Set or update master password
export const PUT = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    const body = await request.json();
    const parsed = setMasterPasswordSchema.safeParse(body);
    if (!parsed.success) {
        return errorResponse(parsed.error.errors[0].message, 400);
    }

    const hash = await bcrypt.hash(parsed.data.password, 10);

    await prisma.systemConfig.upsert({
        where: { key: CONFIG_KEY },
        update: { value: hash },
        create: { key: CONFIG_KEY, value: hash },
    });

    return successResponse({ enabled: true });
});

// DELETE /api/system-config/master-password — Disable master password
export const DELETE = withErrorHandler(async (request: NextRequest) => {
    await requireRole(["MANAGER"], request);

    await prisma.systemConfig.deleteMany({ where: { key: CONFIG_KEY } });

    return successResponse({ enabled: false });
});
