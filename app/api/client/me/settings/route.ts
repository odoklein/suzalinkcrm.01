import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
    bookingUrl: z.string().url().optional().or(z.literal("")),
});

/**
 * GET /api/client/me/settings
 * Returns client-level settings for the current CLIENT user (e.g. bookingUrl).
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "CLIENT") {
        return Response.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const clientId = (session.user as { clientId?: string | null }).clientId;
    if (!clientId) {
        return Response.json(
            { success: true, data: { bookingUrl: "" } },
            { status: 200 }
        );
    }

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { bookingUrl: true },
    });

    if (!client) {
        return Response.json(
            { success: true, data: { bookingUrl: "" } },
            { status: 200 }
        );
    }

    return Response.json({
        success: true,
        data: {
            bookingUrl: client.bookingUrl ?? "",
        },
    });
}

/**
 * PATCH /api/client/me/settings
 * Update client-level settings (e.g. bookingUrl) for the current CLIENT user's company.
 */
export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "CLIENT") {
        return Response.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const clientId = (session.user as { clientId?: string | null }).clientId;
    if (!clientId) {
        return Response.json(
            { success: false, error: "Client non associé" },
            { status: 403 }
        );
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return Response.json(
            { success: false, error: "Données invalides", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const updateData: { bookingUrl?: string | null } = {};
    if (parsed.data.bookingUrl !== undefined) {
        updateData.bookingUrl = parsed.data.bookingUrl || null;
    }

    await prisma.client.update({
        where: { id: clientId },
        data: updateData,
    });

    return Response.json({
        success: true,
        message: "Paramètres enregistrés",
    });
}
