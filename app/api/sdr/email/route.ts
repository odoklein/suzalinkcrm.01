import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ============================================
// SCHEMAS
// ============================================

const connectEmailSchema = z.object({
    provider: z.enum(["gmail", "outlook", "smtp"]),
    // For SMTP
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    // For OAuth (tokens would come from OAuth flow)
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
});

// ============================================
// GET /api/sdr/email
// Get email connection status
// ============================================

export async function GET(request: NextRequest) {
    try {
        const session = await requireAuth(request);

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                emailConnected: true,
                emailProvider: true,
                smtpHost: true,
                smtpUser: true,
                // Don't expose password or tokens
            },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Utilisateur non trouvé" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                connected: user.emailConnected,
                provider: user.emailProvider,
                email: user.smtpUser || null,
            },
        });
    } catch (error) {
        console.error("Error getting email status:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

// ============================================
// POST /api/sdr/email
// Connect email account
// ============================================

export async function POST(request: NextRequest) {
    try {
        const session = await requireAuth(request);

        const body = await request.json();
        const parsed = connectEmailSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Données invalides", details: parsed.error.errors },
                { status: 400 }
            );
        }

        const { provider, smtpHost, smtpPort, smtpUser, smtpPassword, accessToken, refreshToken, expiresAt } = parsed.data;

        // Prepare update data
        const updateData: Record<string, unknown> = {
            emailProvider: provider,
            emailConnected: true,
        };

        if (provider === "smtp") {
            if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
                return NextResponse.json(
                    { success: false, error: "Configuration SMTP incomplète" },
                    { status: 400 }
                );
            }
            updateData.smtpHost = smtpHost;
            updateData.smtpPort = smtpPort;
            updateData.smtpUser = smtpUser;
            // TODO: Encrypt password before storing
            updateData.smtpPassword = smtpPassword;
        } else {
            // OAuth providers
            if (!accessToken) {
                return NextResponse.json(
                    { success: false, error: "Token d'accès manquant" },
                    { status: 400 }
                );
            }
            // TODO: Encrypt tokens before storing
            updateData.emailTokens = {
                accessToken,
                refreshToken,
                expiresAt,
            };
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message: "Email connecté avec succès",
        });
    } catch (error) {
        console.error("Error connecting email:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE /api/sdr/email
// Disconnect email account
// ============================================

export async function DELETE() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                emailConnected: false,
                emailProvider: null,
                emailTokens: null,
                smtpHost: null,
                smtpPort: null,
                smtpUser: null,
                smtpPassword: null,
            },
        });

        return NextResponse.json({
            success: true,
            message: "Email déconnecté",
        });
    } catch (error) {
        console.error("Error disconnecting email:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
