/**
 * Persona / Target Intelligence API
 *
 * Cross-references call results by:
 * - Function (Contact.title)
 * - Company size (Company.size)
 * - Sector (Company.industry)
 * - Geography (Company.country)
 * - Campaign (Campaign.name)
 *
 * Supports comparison mode:
 * - Two lists within one mission: compareListA, compareListB, missionId
 * - Two missions: compareMissionA, compareMissionB
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';
import { Prisma } from '@prisma/client';

interface DimensionRow {
    value: string;
    calls: number;
    meetings: number;
    callbacks: number;
    conversionRate: number;
}

function buildWhereClause(
    dateFrom: Date,
    dateTo: Date,
    missionIds: string[],
    listIds: string[],
    sdrIds: string[]
): Prisma.Sql {
    const parts: Prisma.Sql[] = [
        Prisma.sql`a."channel" = 'CALL'`,
        Prisma.sql`a."createdAt" >= ${dateFrom}`,
        Prisma.sql`a."createdAt" <= ${dateTo}`,
    ];
    if (missionIds.length > 0) {
        parts.push(Prisma.sql`m.id IN (${Prisma.join(missionIds)})`);
    }
    if (sdrIds.length > 0) {
        parts.push(Prisma.sql`a."sdrId" IN (${Prisma.join(sdrIds)})`);
    }
    if (listIds.length > 0) {
        parts.push(Prisma.sql`(
            (a."companyId" IS NOT NULL AND a."companyId" IN (SELECT id FROM "Company" WHERE "listId" IN (${Prisma.join(listIds)})))
            OR (a."contactId" IS NOT NULL AND a."contactId" IN (SELECT c.id FROM "Contact" c JOIN "Company" co ON c."companyId" = co.id WHERE co."listId" IN (${Prisma.join(listIds)})))
        )`);
    }
    return Prisma.join(parts, ' AND ');
}

async function getPersonaBreakdown(
    dateFrom: Date,
    dateTo: Date,
    missionIds: string[],
    listIds: string[],
    sdrIds: string[]
): Promise<{
    byFunction: DimensionRow[];
    byCompanySize: DimensionRow[];
    bySector: DimensionRow[];
    byGeography: DimensionRow[];
    byCampaign: DimensionRow[];
}> {
    const whereClause = buildWhereClause(dateFrom, dateTo, missionIds, listIds, sdrIds);

    const baseJoin = Prisma.sql`
        FROM "Action" a
        LEFT JOIN "Campaign" c ON a."campaignId" = c.id
        LEFT JOIN "Mission" m ON c."missionId" = m.id
        LEFT JOIN "Contact" ct ON a."contactId" = ct.id
        LEFT JOIN "Company" co ON (ct."companyId" = co.id OR (a."companyId" IS NOT NULL AND a."companyId" = co.id))
        WHERE ${whereClause}
    `;

    const [byFunction, byCompanySize, bySector, byGeography, byCampaign] = await Promise.all([
        // By function (Contact.title)
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                COALESCE(NULLIF(TRIM(ct.title), ''), 'Non renseigné') as value,
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" IN ('CALLBACK_REQUESTED', 'INTERESTED') THEN 1 END)::int as callbacks
            ${baseJoin}
            GROUP BY COALESCE(NULLIF(TRIM(ct.title), ''), 'Non renseigné')
            HAVING COUNT(a.id) >= 1
            ORDER BY calls DESC
        `),
        // By company size
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                COALESCE(NULLIF(TRIM(co.size), ''), 'Non renseigné') as value,
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" IN ('CALLBACK_REQUESTED', 'INTERESTED') THEN 1 END)::int as callbacks
            ${baseJoin}
            GROUP BY COALESCE(NULLIF(TRIM(co.size), ''), 'Non renseigné')
            HAVING COUNT(a.id) >= 1
            ORDER BY calls DESC
        `),
        // By sector (industry)
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                COALESCE(NULLIF(TRIM(co.industry), ''), 'Non renseigné') as value,
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" IN ('CALLBACK_REQUESTED', 'INTERESTED') THEN 1 END)::int as callbacks
            ${baseJoin}
            GROUP BY COALESCE(NULLIF(TRIM(co.industry), ''), 'Non renseigné')
            HAVING COUNT(a.id) >= 1
            ORDER BY calls DESC
        `),
        // By geography (country)
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                COALESCE(NULLIF(TRIM(co.country), ''), 'Non renseigné') as value,
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" IN ('CALLBACK_REQUESTED', 'INTERESTED') THEN 1 END)::int as callbacks
            ${baseJoin}
            GROUP BY COALESCE(NULLIF(TRIM(co.country), ''), 'Non renseigné')
            HAVING COUNT(a.id) >= 1
            ORDER BY calls DESC
        `),
        // By campaign
        prisma.$queryRaw<any[]>(Prisma.sql`
            SELECT 
                COALESCE(NULLIF(TRIM(c.name), ''), 'Sans campagne') as value,
                COUNT(a.id)::int as calls,
                COUNT(CASE WHEN a."result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings,
                COUNT(CASE WHEN a."result" IN ('CALLBACK_REQUESTED', 'INTERESTED') THEN 1 END)::int as callbacks
            ${baseJoin}
            GROUP BY COALESCE(NULLIF(TRIM(c.name), ''), 'Sans campagne')
            HAVING COUNT(a.id) >= 1
            ORDER BY calls DESC
        `),
    ]);

    const formatRow = (row: { value: string; calls: number; meetings: number; callbacks: number }): DimensionRow => ({
        value: row.value || 'Non renseigné',
        calls: row.calls,
        meetings: row.meetings,
        callbacks: row.callbacks,
        conversionRate: row.calls > 0 ? Math.round((row.meetings / row.calls) * 10000) / 100 : 0,
    });

    return {
        byFunction: byFunction.map(formatRow),
        byCompanySize: byCompanySize.map(formatRow),
        bySector: bySector.map(formatRow),
        byGeography: byGeography.map(formatRow),
        byCampaign: byCampaign.map(formatRow),
    };
}

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER', 'DEVELOPER'], request);
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sdrIds = searchParams.getAll('sdrIds[]');
    const missionIds = searchParams.getAll('missionIds[]');
    const listIds = searchParams.getAll('listIds[]');

    // Comparison mode: two segments
    const compareListA = searchParams.get('compareListA');
    const compareListB = searchParams.get('compareListB');
    const compareMissionA = searchParams.getAll('compareMissionA[]');
    const compareMissionB = searchParams.getAll('compareMissionB[]');

    const dateTo = to ? new Date(to) : new Date();
    dateTo.setHours(23, 59, 59, 999);
    const dateFrom = from ? new Date(from) : (() => {
        const d = new Date(dateTo);
        d.setDate(d.getDate() - 30);
        return d;
    })();
    dateFrom.setHours(0, 0, 0, 0);

    const singleMode = !compareListA && !compareListB && compareMissionA.length === 0 && compareMissionB.length === 0;

    if (singleMode) {
        const data = await getPersonaBreakdown(dateFrom, dateTo, missionIds, listIds, sdrIds);
        return successResponse({
            mode: 'single',
            timeframe: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
            ...data,
        });
    }

    // Comparison mode
    let labelA = 'Segment A';
    let labelB = 'Segment B';
    let segmentA: Awaited<ReturnType<typeof getPersonaBreakdown>>;
    let segmentB: Awaited<ReturnType<typeof getPersonaBreakdown>>;

    if (compareListA && compareListB && missionIds.length === 1) {
        // Two lists within one mission
        const [listA, listB] = await Promise.all([
            prisma.list.findUnique({ where: { id: compareListA }, select: { name: true } }),
            prisma.list.findUnique({ where: { id: compareListB }, select: { name: true } }),
        ]);
        labelA = listA?.name ?? 'Liste A';
        labelB = listB?.name ?? 'Liste B';
        segmentA = await getPersonaBreakdown(dateFrom, dateTo, missionIds, [compareListA], sdrIds);
        segmentB = await getPersonaBreakdown(dateFrom, dateTo, missionIds, [compareListB], sdrIds);
    } else if (compareMissionA.length > 0 && compareMissionB.length > 0) {
        // Two missions
        const [missionA, missionB] = await Promise.all([
            prisma.mission.findMany({ where: { id: { in: compareMissionA } }, select: { name: true } }),
            prisma.mission.findMany({ where: { id: { in: compareMissionB } }, select: { name: true } }),
        ]);
        labelA = missionA.map((m) => m.name).join(', ') || 'Mission(s) A';
        labelB = missionB.map((m) => m.name).join(', ') || 'Mission(s) B';
        segmentA = await getPersonaBreakdown(dateFrom, dateTo, compareMissionA, [], sdrIds);
        segmentB = await getPersonaBreakdown(dateFrom, dateTo, compareMissionB, [], sdrIds);
    } else {
        return errorResponse('Invalid compare params: use compareListA+compareListB+missionIds, or compareMissionA[]+compareMissionB[]', 400);
    }

    return successResponse({
        mode: 'compare',
        timeframe: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
        segmentA: { label: labelA, ...segmentA },
        segmentB: { label: labelB, ...segmentB },
    });
});
