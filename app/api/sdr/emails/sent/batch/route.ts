// ============================================
// POST /api/sdr/emails/sent/batch
// Batch operations on sent emails: delete, resend
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth(req);

        const body = await req.json();
        const { action, emailIds } = body as {
            action: "delete" | "resend";
            emailIds: string[];
        };

        if (!action || !emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "Action et emailIds requis" },
                { status: 400 }
            );
        }

        if (emailIds.length > 100) {
            return NextResponse.json(
                { success: false, error: "Maximum 100 emails par opération batch" },
                { status: 400 }
            );
        }

        // Verify ownership - only allow operations on emails sent by the current user
        const ownedEmails = await prisma.email.findMany({
            where: {
                id: { in: emailIds },
                sentById: session.user.id,
                direction: "OUTBOUND",
            },
            select: { id: true },
        });

        const ownedIds = ownedEmails.map((e) => e.id);

        if (ownedIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "Aucun email trouvé ou non autorisé" },
                { status: 404 }
            );
        }

        let result: { affected: number; action: string };

        switch (action) {
            case "delete": {
                const deleted = await prisma.email.deleteMany({
                    where: {
                        id: { in: ownedIds },
                    },
                });
                result = { affected: deleted.count, action: "delete" };
                break;
            }

            case "resend": {
                // Mark emails for resend by resetting their status to QUEUED
                const updated = await prisma.email.updateMany({
                    where: {
                        id: { in: ownedIds },
                        status: { in: ["FAILED", "BOUNCED"] },
                    },
                    data: {
                        status: "QUEUED",
                        errorMessage: null,
                        bounceType: null,
                    },
                });
                result = { affected: updated.count, action: "resend" };
                break;
            }

            default:
                return NextResponse.json(
                    { success: false, error: `Action inconnue: ${action}` },
                    { status: 400 }
                );
        }

        return NextResponse.json({
            success: true,
            data: result,
            message: `${result.affected} email(s) ${action === "delete" ? "supprimé(s)" : "remis en file d'attente"}`,
        });
    } catch (error) {
        console.error("POST /api/sdr/emails/sent/batch error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
