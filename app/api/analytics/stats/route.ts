import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';
import { ActionResult, Prisma } from '@prisma/client';
import { parseAlloCallsListResponse } from '@/lib/call-enrichment/allo-response';

export const GET = withErrorHandler(async (request: NextRequest) => {
    // Only Managers and Developers can see full team stats
    const session = await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sdrIds = searchParams.getAll('sdrIds[]');
    const missionIds = searchParams.getAll('missionIds[]');
    const clientIds = searchParams.getAll('clientIds[]');
    const listIds = searchParams.getAll('listIds[]');

    // Default timeframe: last 30 days
    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);

    const dateFrom = from ? new Date(from) : new Date(dateTo);
    if (!from) {
        dateFrom.setDate(dateFrom.getDate() - 30);
    }
    dateFrom.setHours(0, 0, 0, 0);

    // Dynamic filters for calls
    const where: Prisma.ActionWhereInput = {
        channel: 'CALL',
        createdAt: {
            gte: dateFrom,
            lte: dateTo,
        },
    };

    if (sdrIds.length > 0) {
        where.sdrId = { in: sdrIds };
    }

    if (missionIds.length > 0 || clientIds.length > 0) {
        where.campaign = {
            mission: {
                ...(missionIds.length > 0 && { id: { in: missionIds } }),
                ...(clientIds.length > 0 && { clientId: { in: clientIds } }),
            }
        };
    }

    if (listIds.length > 0) {
        where.OR = [
            { company: { listId: { in: listIds } } },
            { contact: { company: { listId: { in: listIds } } } },
        ];
    }

    // Prepare SQL Fragments for filtering in raw queries
    const sdrFilterRaw = sdrIds.length > 0
        ? Prisma.sql`AND "sdrId" IN (${Prisma.join(sdrIds)})`
        : Prisma.empty;

    const sdrFilterAliasA = sdrIds.length > 0
        ? Prisma.sql`AND a."sdrId" IN (${Prisma.join(sdrIds)})`
        : Prisma.empty;

    const missionFilterAliasM = missionIds.length > 0
        ? Prisma.sql`AND m.id IN (${Prisma.join(missionIds)})`
        : Prisma.empty;

    const clientFilterAliasM = clientIds.length > 0
        ? Prisma.sql`AND m."clientId" IN (${Prisma.join(clientIds)})`
        : Prisma.empty;

    const listFilterRaw = listIds.length > 0
        ? Prisma.sql`AND (
            "companyId" IS NOT NULL AND "companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)}))
            OR "contactId" IS NOT NULL AND "contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)}))
        )`
        : Prisma.empty;

    const listFilterAliasA = listIds.length > 0
        ? Prisma.sql`AND (
            a."companyId" IS NOT NULL AND a."companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)}))
            OR a."contactId" IS NOT NULL AND a."contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)}))
        )`
        : Prisma.empty;

    // Heavy Lifting with Parallel Aggregations
    const [
        basicStats,
        statusBreakdown,
        dailyVolume,
        heatmapData,
        sdrPerformanceData,
        missionStatesData
    ] = await Promise.all([
        // 1. Basic KPIs
        prisma.action.aggregate({
            where,
            _count: { id: true, contactId: true },
            _sum: { duration: true },
        }),

        // 2. Status Distribution
        prisma.action.groupBy({
            by: ['result'],
            where,
            _count: { id: true },
        }),

        // 3. Daily Stats for the main chart
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
                COUNT(*)::int as calls,
                COUNT(CASE WHEN "result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilterRaw}
              ${listFilterRaw}
            GROUP BY date
            ORDER BY date ASC
        `),

        // 4. Temporal Heatmap
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'FMDay') as day,
                EXTRACT(HOUR FROM "createdAt")::int as hour,
                COUNT(*)::int as count
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilterRaw}
              ${listFilterRaw}
            GROUP BY day, hour
        `),

        // 5. SDR Performance
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                u.id as "sdrId",
                u."name" as "sdrName",
                u."role" as "sdrRole",
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'CALLBACK_REQUESTED' THEN 1 END)::int as callbacks,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" = 'DISQUALIFIED' THEN 1 END)::int as disqualified,
                COUNT(CASE WHEN a."result" != 'NO_RESPONSE' THEN 1 END)::int as contacts
            FROM "Action" a
            JOIN "User" u ON a."sdrId" = u.id
            LEFT JOIN "Campaign" c ON a."campaignId" = c.id
            LEFT JOIN "Mission" m ON c."missionId" = m.id
            WHERE a."channel" = 'CALL'
              AND a."createdAt" >= ${dateFrom}
              AND a."createdAt" <= ${dateTo}
              ${sdrFilterAliasA}
              ${missionFilterAliasM}
              ${clientFilterAliasM}
              ${listFilterAliasA}
            GROUP BY u.id, u."name", u."role"
            ORDER BY calls DESC
        `),

        // 6. Mission States
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                m.id as "missionId",
                m."name" as "missionName",
                m."isActive" as "isActive",
                cl."name" as "clientName",
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'CALLBACK_REQUESTED' THEN 1 END)::int as callbacks,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                string_agg(DISTINCT u."name", ',') as "sdrNames"
            FROM "Action" a
            JOIN "Campaign" c ON a."campaignId" = c.id
            JOIN "Mission" m ON c."missionId" = m.id
            JOIN "Client" cl ON m."clientId" = cl.id
            JOIN "User" u ON a."sdrId" = u.id
            WHERE a."channel" = 'CALL'
              AND a."createdAt" >= ${dateFrom}
              AND a."createdAt" <= ${dateTo}
              ${sdrFilterAliasA}
              ${missionFilterAliasM}
              ${clientFilterAliasM}
              ${listFilterAliasA}
            GROUP BY m.id, m."name", m."isActive", cl."name"
            ORDER BY calls DESC
            LIMIT 10
        `),
    ]);

    const sdrPerformanceWithAllo = await enrichSdrPerformanceWithAlloCalls(
        sdrPerformanceData,
        dateFrom,
        dateTo
    );

    // Formatting Status Distribution
    const statuses: Record<string, number> = {};
    statusBreakdown.forEach(curr => {
        statuses[curr.result] = curr._count.id;
    });

    const totalCalls = basicStats._count.id;
    const noResponse = statuses['NO_RESPONSE'] || 0;
    const contacts = totalCalls - noResponse;
    const callbacks = statuses['CALLBACK_REQUESTED'] || 0;
    const meetings = statuses['MEETING_BOOKED'] || 0;
    const interested = statuses['INTERESTED'] || 0;

    // Grouped Status Segments per User Request
    const segments = {
        success: meetings + interested,
        neutral: callbacks + noResponse + (statuses['ENVOIE_MAIL'] || 0) + (statuses['MAIL_ENVOYE'] || 0),
        failure: (statuses['BAD_CONTACT'] || 0) + (statuses['DISQUALIFIED'] || 0) + (statuses['MEETING_CANCELLED'] || 0) + (statuses['INVALIDE'] || 0) + (statuses['NOT_INTERESTED'] || 0),
    };

    // Funnel Steps 
    const funnel = {
        totalCalls,
        contacts,
        opportunities: callbacks + interested,
        meetings
    };

    return successResponse({
        timeframe: { from: dateFrom, to: dateTo },
        kpis: {
            totalCalls,
            uniqueContacts: basicStats._count.contactId,
            totalTalkTime: basicStats._sum.duration || 0,
            avgCallDuration: totalCalls > 0 ? Math.round((basicStats._sum.duration || 0) / totalCalls) : 0,
            conversionRate: totalCalls > 0 ? Number(((meetings / totalCalls) * 100).toFixed(2)) : 0,
            interestRate: totalCalls > 0 ? Number(((segments.success / totalCalls) * 100).toFixed(2)) : 0,
            meetings,
        },
        statusBreakdown: statuses,
        segments,
        funnel,
        sdrPerformance: sdrPerformanceWithAllo,
        missionStates: missionStatesData.map(m => ({
            ...m,
            sdrNames: m.sdrNames ? m.sdrNames.split(',') : []
        })),
        charts: {
            daily: dailyVolume,
            heatmap: heatmapData.map(h => ({
                key: `${h.day.trim().substring(0, 3)}-${h.hour}`,
                count: h.count
            }))
        }
    });

});

const ALLO_BASE_URL = 'https://api.withallo.com';
const ALLO_CONNECTED_RESULTS = new Set([
    'ANSWERED',
    'TRANSFERRED_AI',
    'TRANSFERRED_EXTERNAL',
    'RECEIVED',
    'CLOSED',
]);
const ALLO_MAX_PAGES = Math.max(1, parseInt(process.env.CALL_ENRICHMENT_ALLO_MAX_PAGES ?? '60', 10));

async function enrichSdrPerformanceWithAlloCalls(
    rows: any[],
    dateFrom: Date,
    dateTo: Date
): Promise<any[]> {
    if (!Array.isArray(rows) || rows.length === 0) {
        return rows;
    }

    const apiKey = process.env.ALLO_API_KEY;
    if (!apiKey) {
        return rows.map((r) => ({
            ...r,
            crmActions: r.calls ?? 0,
            alloCalls: 0,
            connectedCalls: 0,
        }));
    }

    const sdrIds = rows
        .map((r) => String(r.sdrId || ''))
        .filter(Boolean);
    if (sdrIds.length === 0) {
        return rows;
    }

    const users = await prisma.user.findMany({
        where: { id: { in: sdrIds } },
        select: { id: true, alloPhoneNumber: true },
    });

    const lineBySdrId = new Map(
        users.map((u) => [u.id, (u.alloPhoneNumber || '').trim()])
    );
    const uniqueLines = [...new Set(
        users
            .map((u) => (u.alloPhoneNumber || '').trim())
            .filter((n) => !!n)
    )];

    const metricsByLine = await fetchAlloCallMetricsByLine(
        uniqueLines,
        dateFrom,
        dateTo,
        apiKey
    );

    return rows.map((r) => {
        const line = lineBySdrId.get(String(r.sdrId || '')) || '';
        const metrics = line ? (metricsByLine[line] || { calls: 0, connectedCalls: 0 }) : { calls: 0, connectedCalls: 0 };
        return {
            ...r,
            crmActions: r.calls ?? 0,
            alloCalls: metrics.calls,
            connectedCalls: metrics.connectedCalls,
        };
    });
}

function normalizeDay(date: Date): string {
    return date.toISOString().split('T')[0];
}

async function fetchAlloCallMetricsByLine(
    alloNumbers: string[],
    dateFrom: Date,
    dateTo: Date,
    apiKey: string
): Promise<Record<string, { calls: number; connectedCalls: number }>> {
    const byLine: Record<string, { calls: number; connectedCalls: number }> = {};
    const fromIso = normalizeDay(dateFrom);
    const toIso = normalizeDay(dateTo);

    for (const alloNumber of alloNumbers) {
        let page = 0;
        const totals = { calls: 0, connectedCalls: 0 };

        while (page < ALLO_MAX_PAGES) {
            const url = new URL(`${ALLO_BASE_URL}/v1/api/calls`);
            url.searchParams.set('allo_number', alloNumber);
            url.searchParams.set('size', '100');
            url.searchParams.set('page', String(page));

            const res = await fetch(url.toString(), {
                headers: { Authorization: apiKey },
                cache: 'no-store',
            });
            if (!res.ok) {
                break;
            }

            const body = await res.json();
            const parsed = parseAlloCallsListResponse(body);
            if (!parsed.rawCalls.length) {
                break;
            }

            let oldestCallDateOnPage: Date | null = null;
            for (const call of parsed.rawCalls) {
                const rawStart = call.start_date ?? call.start_time ?? call.created_at ?? call.date;
                if (!rawStart) continue;
                const start = new Date(String(rawStart));
                if (Number.isNaN(start.getTime())) continue;

                if (!oldestCallDateOnPage || start < oldestCallDateOnPage) {
                    oldestCallDateOnPage = start;
                }

                const isoDay = normalizeDay(start);
                if (isoDay < fromIso || isoDay > toIso) continue;

                totals.calls += 1;
                const result = typeof call.result === 'string' ? call.result.toUpperCase() : '';
                if (ALLO_CONNECTED_RESULTS.has(result)) {
                    totals.connectedCalls += 1;
                }
            }

            if (oldestCallDateOnPage && oldestCallDateOnPage < dateFrom) {
                break;
            }

            page += 1;
        }

        byLine[alloNumber] = totals;
    }

    return byLine;
}
