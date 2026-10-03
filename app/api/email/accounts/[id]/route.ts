import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// DELETE /api/email/accounts/[id] - Remove email account or OAuth mailbox
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        const account = await prisma.emailAccount.findUnique({
            where: { id },
        });

        if (account) {
            if (account.userId !== session.user.id) {
                return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
            }
            await prisma.emailAccount.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

        const mailbox = await prisma.mailbox.findUnique({
            where: { id },
        });
        if (mailbox) {
            if (mailbox.ownerId !== session.user.id) {
                return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
            }
            await prisma.mailbox.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Compte non trouvé" }, { status: 404 });
    } catch (error) {
        console.error("DELETE /api/email/accounts/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// PATCH /api/email/accounts/[id] - Update email account
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { displayName, isActive, smtpHost, smtpPort, imapHost, imapPort, password } = body;

        const account = await prisma.emailAccount.findUnique({
            where: { id },
        });

        if (!account) {
            return NextResponse.json({ success: false, error: "Compte non trouvé" }, { status: 404 });
        }

        if (account.userId !== session.user.id) {
            return NextResponse.json({ success: false, error: "Accès refusé" }, { status: 403 });
        }

        const updated = await prisma.emailAccount.update({
            where: { id },
            data: {
                ...(displayName !== undefined && { displayName: displayName?.trim() || null }),
                ...(isActive !== undefined && { isActive }),
                ...(smtpHost !== undefined && { smtpHost: smtpHost?.trim() || null }),
                ...(smtpPort !== undefined && { smtpPort }),
                ...(imapHost !== undefined && { imapHost: imapHost?.trim() || null }),
                ...(imapPort !== undefined && { imapPort }),
                ...(password !== undefined && { password }),
            },
            select: {
                id: true,
                provider: true,
                email: true,
                displayName: true,
                isActive: true,
                lastSyncAt: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error("PATCH /api/email/accounts/[id] error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
