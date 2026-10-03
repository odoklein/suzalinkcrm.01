import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/email/accounts - List email accounts (EmailAccount + OAuth Mailboxes for unified view)
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const role = session.user.role;
        if (!["MANAGER", "DEVELOPER"].includes(role || "")) {
            return NextResponse.json({ success: false, error: "Rôle non autorisé" }, { status: 403 });
        }

        const [emailAccounts, mailboxes] = await Promise.all([
            prisma.emailAccount.findMany({
                where: { userId: session.user.id },
                select: {
                    id: true,
                    provider: true,
                    email: true,
                    displayName: true,
                    isActive: true,
                    lastSyncAt: true,
                    syncError: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.mailbox.findMany({
                where: { ownerId: session.user.id, provider: { in: ["GMAIL", "OUTLOOK"] } },
                select: {
                    id: true,
                    provider: true,
                    email: true,
                    displayName: true,
                    isActive: true,
                    lastSyncAt: true,
                    lastError: true,
                    createdAt: true,
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        const accountItems = emailAccounts.map((a) => ({
            id: a.id,
            provider: a.provider,
            email: a.email,
            displayName: a.displayName,
            isActive: a.isActive,
            lastSyncAt: a.lastSyncAt,
            syncError: a.syncError,
            createdAt: a.createdAt,
            source: "account" as const,
        }));
        const mailboxItems = mailboxes.map((m) => ({
            id: m.id,
            provider: m.provider,
            email: m.email,
            displayName: m.displayName,
            isActive: m.isActive,
            lastSyncAt: m.lastSyncAt,
            syncError: m.lastError,
            createdAt: m.createdAt,
            source: "mailbox" as const,
        }));

        const combined = [...mailboxItems, ...accountItems].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return NextResponse.json({ success: true, data: combined });
    } catch (error) {
        console.error("GET /api/email/accounts error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// POST /api/email/accounts - Add custom SMTP/IMAP account
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const role = session.user.role;
        if (!["MANAGER", "DEVELOPER"].includes(role || "")) {
            return NextResponse.json({ success: false, error: "Rôle non autorisé" }, { status: 403 });
        }

        const body = await req.json();
        const { email, displayName, smtpHost, smtpPort, imapHost, imapPort, password } = body;

        if (!email?.trim()) {
            return NextResponse.json({ success: false, error: "Email requis" }, { status: 400 });
        }

        // Check if account already exists
        const existing = await prisma.emailAccount.findFirst({
            where: { userId: session.user.id, email: email.trim() },
        });

        if (existing) {
            return NextResponse.json({ success: false, error: "Compte email déjà ajouté" }, { status: 400 });
        }

        const account = await prisma.emailAccount.create({
            data: {
                userId: session.user.id,
                provider: "CUSTOM",
                email: email.trim(),
                displayName: displayName?.trim() || null,
                smtpHost: smtpHost?.trim() || null,
                smtpPort: smtpPort || null,
                imapHost: imapHost?.trim() || null,
                imapPort: imapPort || null,
                password: password || null, // Should be encrypted in production
            },
            select: {
                id: true,
                provider: true,
                email: true,
                displayName: true,
                isActive: true,
                createdAt: true,
            },
        });

        return NextResponse.json({ success: true, data: account });
    } catch (error) {
        console.error("POST /api/email/accounts error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
