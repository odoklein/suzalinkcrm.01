// ============================================
// GET  /api/manager/emails/sent  — all team outbound emails
// POST /api/manager/emails/sent  — bulk actions (delete / resend)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET ──────────────────────────────────────

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const role = session.user.role;
        if (role !== "MANAGER" && role !== "DEVELOPER") {
            return NextResponse.json({ success: false, error: "Accès non autorisé" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const sortBy = searchParams.get("sortBy") || "sentAt";
        const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
        const includeStats = searchParams.get("includeStats") === "true";

        // Filters
        const missionId = searchParams.get("missionId") || undefined;
        const sdrId = searchParams.get("sdrId") || undefined;
        const clientId = searchParams.get("clientId") || undefined;
        const status = searchParams.get("status") || undefined;
        const templateId = searchParams.get("templateId") || undefined;
        const search = searchParams.get("search") || undefined;
        const dateFrom = searchParams.get("dateFrom") || undefined;
        const dateTo = searchParams.get("dateTo") || undefined;
        const hasOpened = searchParams.get("hasOpened") || undefined;
        const hasClicked = searchParams.get("hasClicked") || undefined;

        const where: Record<string, unknown> = {
            direction: "OUTBOUND",
            status: { not: "DRAFT" },
        };

        if (missionId) where.missionId = missionId;
        if (sdrId) where.sentById = sdrId;
        if (status) where.status = status;
        if (templateId) where.templateId = templateId;

        if (clientId) {
            where.mission = { client: { id: clientId } };
        }

        if (hasOpened === "true") where.openCount = { gt: 0 };
        if (hasOpened === "false") where.openCount = 0;
        if (hasClicked === "true") where.clickCount = { gt: 0 };
        if (hasClicked === "false") where.clickCount = 0;

        if (dateFrom || dateTo) {
            where.sentAt = {
                ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                ...(dateTo ? { lte: new Date(dateTo + "T23:59:59") } : {}),
            };
        }

        if (search) {
            where.OR = [
                { subject: { contains: search, mode: "insensitive" } },
                { contact: { firstName: { contains: search, mode: "insensitive" } } },
                { contact: { lastName: { contains: search, mode: "insensitive" } } },
                { contact: { email: { contains: search, mode: "insensitive" } } },
                { sentBy: { name: { contains: search, mode: "insensitive" } } },
            ];
        }

        const validSortFields: Record<string, unknown> = {
            sentAt: { sentAt: sortOrder },
            subject: { subject: sortOrder },
            openCount: { openCount: sortOrder },
            clickCount: { clickCount: sortOrder },
            status: { status: sortOrder },
        };
        const orderBy = validSortFields[sortBy] || { sentAt: "desc" };

        const skip = (page - 1) * limit;

        const [emails, total] = await Promise.all([
            prisma.email.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    contact: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            company: { select: { id: true, name: true } },
                        },
                    },
                    mission: {
                        select: {
                            id: true,
                            name: true,
                            client: { select: { id: true, name: true } },
                        },
                    },
                    sentBy: {
                        select: { id: true, name: true, email: true },
                    },
                    template: { select: { id: true, name: true } },
                },
            }),
            prisma.email.count({ where }),
        ]);

        let stats = null;
        if (includeStats) {
            const statsWhere = { ...where };
            // Remove pagination-only concerns from stats
            const agg = await prisma.email.aggregate({
                where: statsWhere,
                _count: { id: true },
                _sum: { openCount: true, clickCount: true },
            });
            const statusCounts = await prisma.email.groupBy({
                by: ["status"],
                where: statsWhere,
                _count: { id: true },
            });

            const byStatus: Record<string, number> = {};
            statusCounts.forEach((s) => {
                byStatus[s.status] = s._count.id;
            });

            const totalSent = agg._count.id;
            const totalOpened = await prisma.email.count({ where: { ...statsWhere, openCount: { gt: 0 } } });
            const totalClicked = await prisma.email.count({ where: { ...statsWhere, clickCount: { gt: 0 } } });

            stats = {
                totalSent,
                totalOpened,
                totalClicked,
                totalReplied: byStatus["REPLIED"] || 0,
                totalBounced: byStatus["BOUNCED"] || 0,
                totalFailed: byStatus["FAILED"] || 0,
                openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
                clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
                replyRate: totalSent > 0 ? Math.round(((byStatus["REPLIED"] || 0) / totalSent) * 100) : 0,
                bounceRate: totalSent > 0 ? Math.round(((byStatus["BOUNCED"] || 0) / totalSent) * 100) : 0,
            };
        }

        return NextResponse.json({
            success: true,
            data: emails,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            ...(stats ? { stats } : {}),
        });
    } catch (error) {
        console.error("GET /api/manager/emails/sent error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}

// ── POST (batch) ──────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
        }

        const role = session.user.role;
        if (role !== "MANAGER" && role !== "DEVELOPER") {
            return NextResponse.json({ success: false, error: "Accès non autorisé" }, { status: 403 });
        }

        const body = await req.json();
        const { action, emailIds } = body;

        if (!action || !Array.isArray(emailIds) || emailIds.length === 0) {
            return NextResponse.json({ success: false, error: "action et emailIds requis" }, { status: 400 });
        }

        if (emailIds.length > 200) {
            return NextResponse.json({ success: false, error: "Maximum 200 emails par opération" }, { status: 400 });
        }

        if (action === "delete") {
            const result = await prisma.email.deleteMany({
                where: { id: { in: emailIds } },
            });
            return NextResponse.json({
                success: true,
                data: { affected: result.count, action: "delete" },
                message: `${result.count} email(s) supprimé(s)`,
            });
        }

        if (action === "resend") {
            const result = await prisma.email.updateMany({
                where: {
                    id: { in: emailIds },
                    status: { in: ["FAILED", "BOUNCED"] },
                },
                data: { status: "QUEUED" },
            });
            return NextResponse.json({
                success: true,
                data: { affected: result.count, action: "resend" },
                message: `${result.count} email(s) mis en file de renvoi`,
            });
        }

        return NextResponse.json({ success: false, error: "Action invalide" }, { status: 400 });
    } catch (error) {
        console.error("POST /api/manager/emails/sent error:", error);
        return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
    }
}
