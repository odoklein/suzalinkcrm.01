// ============================================
// GET /api/sdr/emails/sent
// List emails sent by current SDR with full filters, pagination, search & stats
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);

        // Pagination
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
        const skip = (page - 1) * limit;

        // Filters
        const missionId = searchParams.get("missionId")?.trim() || null;
        const status = searchParams.get("status")?.trim() || null;
        const templateId = searchParams.get("templateId")?.trim() || null;
        const search = searchParams.get("search")?.trim() || null;
        const dateFrom = searchParams.get("dateFrom")?.trim() || null;
        const dateTo = searchParams.get("dateTo")?.trim() || null;
        const hasOpened = searchParams.get("hasOpened"); // "true" | "false" | null
        const hasClicked = searchParams.get("hasClicked"); // "true" | "false" | null

        // Sorting
        const sortBy = searchParams.get("sortBy") || "sentAt";
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

        // Include stats summary?
        const includeStats = searchParams.get("includeStats") === "true";

        // Build where clause
        const where: Prisma.EmailWhereInput = {
            direction: "OUTBOUND",
            sentById: session.user.id,
        };

        // Mission filter
        if (missionId) {
            where.missionId = missionId;
        } else {
            // Show all sent emails (not just mission ones)
            // Don't filter by missionId
        }

        // Status filter
        if (status) {
            where.status = status as Prisma.EmailWhereInput["status"];
        }

        // Template filter
        if (templateId) {
            where.templateId = templateId;
        }

        // Date range
        if (dateFrom || dateTo) {
            where.sentAt = {};
            if (dateFrom) {
                (where.sentAt as Prisma.DateTimeNullableFilter).gte = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                (where.sentAt as Prisma.DateTimeNullableFilter).lte = endDate;
            }
        }

        // Open/Click filters
        if (hasOpened === "true") {
            where.openCount = { gt: 0 };
        } else if (hasOpened === "false") {
            where.openCount = 0;
        }

        if (hasClicked === "true") {
            where.clickCount = { gt: 0 };
        } else if (hasClicked === "false") {
            where.clickCount = 0;
        }

        // Search (subject, contact name, contact email)
        if (search) {
            where.OR = [
                { subject: { contains: search, mode: "insensitive" } },
                { contact: { firstName: { contains: search, mode: "insensitive" } } },
                { contact: { lastName: { contains: search, mode: "insensitive" } } },
                { contact: { email: { contains: search, mode: "insensitive" } } },
                { contact: { company: { name: { contains: search, mode: "insensitive" } } } },
            ];
        }

        // Sorting map
        const orderByMap: Record<string, Prisma.EmailOrderByWithRelationInput> = {
            sentAt: { sentAt: sortOrder },
            subject: { subject: sortOrder },
            openCount: { openCount: sortOrder },
            clickCount: { clickCount: sortOrder },
            status: { status: sortOrder },
        };
        const orderBy = orderByMap[sortBy] || { sentAt: "desc" };

        // Fetch emails + count in parallel
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
                            company: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    mission: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    template: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    sequenceStep: {
                        select: {
                            id: true,
                            order: true,
                            sequence: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.email.count({ where }),
        ]);

        // Build stats if requested
        let stats = null;
        if (includeStats) {
            const baseWhere: Prisma.EmailWhereInput = {
                direction: "OUTBOUND",
                sentById: session.user.id,
            };

            const [totalSent, totalOpened, totalClicked, totalBounced, totalReplied, totalFailed] = await Promise.all([
                prisma.email.count({ where: { ...baseWhere, status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] } } }),
                prisma.email.count({ where: { ...baseWhere, openCount: { gt: 0 } } }),
                prisma.email.count({ where: { ...baseWhere, clickCount: { gt: 0 } } }),
                prisma.email.count({ where: { ...baseWhere, status: "BOUNCED" } }),
                prisma.email.count({ where: { ...baseWhere, status: "REPLIED" } }),
                prisma.email.count({ where: { ...baseWhere, status: "FAILED" } }),
            ]);

            stats = {
                totalSent,
                totalOpened,
                totalClicked,
                totalBounced,
                totalReplied,
                totalFailed,
                openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100 * 10) / 10 : 0,
                clickRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100 * 10) / 10 : 0,
                replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100 * 10) / 10 : 0,
                bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100 * 10) / 10 : 0,
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
        console.error("GET /api/sdr/emails/sent error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
