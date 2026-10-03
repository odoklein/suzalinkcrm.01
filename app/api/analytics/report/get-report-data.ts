/**
 * Server-only: fetch stats + notes for analytics report.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ReportDataParams {
    from: string;
    to: string;
    missionIds: string[];
    sdrIds: string[];
    clientIds: string[];
    listIds?: string[];
}

export interface ReportDataResult {
    missionLabel: string;
    periodLabel: string;
    kpis: {
        totalCalls: number;
        meetings: number;
        conversionRate: number;
        totalTalkTime: number;
        noResponse: number;
        callbacks: number;
    };
    statusBreakdown: Record<string, number>;
    sdrPerformance: Array<{ sdrName: string; calls: number; meetings: number; callbacks: number }>;
    notesSample: string[];
}

export async function getAnalyticsReportData(params: ReportDataParams): Promise<ReportDataResult> {
    const { from, to, missionIds, sdrIds, clientIds, listIds = [] } = params;

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateFrom.setHours(0, 0, 0, 0);
    dateTo.setHours(23, 59, 59, 999);

    const where: Prisma.ActionWhereInput = {
        channel: 'CALL',
        createdAt: { gte: dateFrom, lte: dateTo },
    };
    if (sdrIds.length > 0) where.sdrId = { in: sdrIds };
    if (missionIds.length > 0 || clientIds.length > 0) {
        where.campaign = {
            mission: {
                ...(missionIds.length > 0 && { id: { in: missionIds } }),
                ...(clientIds.length > 0 && { clientId: { in: clientIds } }),
            },
        };
    }
    if (listIds.length > 0) {
        where.OR = [
            { company: { listId: { in: listIds } } },
            { contact: { company: { listId: { in: listIds } } } },
        ];
    }

    const sdrFilterRaw = sdrIds.length > 0
        ? Prisma.sql`AND a."sdrId" IN (${Prisma.join(sdrIds)})`
        : Prisma.empty;
    const missionFilterM = missionIds.length > 0
        ? Prisma.sql`AND m.id IN (${Prisma.join(missionIds)})`
        : Prisma.empty;
    const clientFilterM = clientIds.length > 0
        ? Prisma.sql`AND m."clientId" IN (${Prisma.join(clientIds)})`
        : Prisma.empty;
    const listFilterA = listIds.length > 0
        ? Prisma.sql`AND (
            a."companyId" IS NOT NULL AND a."companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)}))
            OR a."contactId" IS NOT NULL AND a."contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)}))
        )`
        : Prisma.empty;

    const [basicStats, statusBreakdown, sdrPerf, actionsWithNotes, missionNames] = await Promise.all([
        prisma.action.aggregate({
            where,
            _count: { id: true },
            _sum: { duration: true },
        }),
        prisma.action.groupBy({
            by: ['result'],
            where,
            _count: { id: true },
        }),
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT u."name" as "sdrName", COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" = 'CALLBACK_REQUESTED' OR a."result" = 'INTERESTED' THEN 1 END)::int as callbacks
            FROM "Action" a
            JOIN "User" u ON a."sdrId" = u.id
            LEFT JOIN "Campaign" c ON a."campaignId" = c.id
            LEFT JOIN "Mission" m ON c."missionId" = m.id
            WHERE a."channel" = 'CALL'
              AND a."createdAt" >= ${dateFrom}
              AND a."createdAt" <= ${dateTo}
              ${sdrFilterRaw}
              ${missionFilterM}
              ${clientFilterM}
              ${listFilterA}
            GROUP BY u.id, u."name"
            ORDER BY calls DESC
        `),
        prisma.action.findMany({
            where: { ...where, note: { not: null } },
            select: { note: true, result: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        missionIds.length === 1
            ? prisma.mission.findUnique({
                where: { id: missionIds[0] },
                select: { name: true },
            })
            : null,
    ]);

    const statuses: Record<string, number> = {};
    statusBreakdown.forEach((s) => { statuses[s.result] = s._count.id; });

    const totalCalls = basicStats._count.id;
    const meetings = statuses['MEETING_BOOKED'] || 0;
    const conversionRate = totalCalls > 0 ? Math.round((meetings / totalCalls) * 10000) / 100 : 0;

    const notesSample = actionsWithNotes
        .filter((a) => a.note && a.note.trim().length > 5)
        .slice(0, 30)
        .map((a) => (a.note || '').trim());

    const missionLabel = missionNames?.name || (missionIds.length > 0 ? `${missionIds.length} mission(s)` : 'Toutes les missions');
    const periodLabel = `${dateFrom.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} – ${dateTo.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    return {
        missionLabel,
        periodLabel,
        kpis: {
            totalCalls,
            meetings,
            conversionRate,
            totalTalkTime: basicStats._sum.duration || 0,
            noResponse: statuses['NO_RESPONSE'] || 0,
            callbacks: (statuses['CALLBACK_REQUESTED'] || 0) + (statuses['INTERESTED'] || 0),
        },
        statusBreakdown: statuses,
        sdrPerformance: (sdrPerf || []).map((s) => ({
            sdrName: s.sdrName,
            calls: s.calls,
            meetings: s.meetings,
            callbacks: s.callbacks,
        })),
        notesSample,
    };
}
