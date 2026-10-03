import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    console.log('--- Testing Analytics Queries ---');

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);

    const sdrFilter = Prisma.empty;

    try {
        console.log('1. Testing Daily Volume Query...');
        const dailyVolume = await prisma.$queryRaw(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
                COUNT(*)::int as calls,
                COUNT(CASE WHEN "result" = 'MEETING_BOOKED' THEN 1 END)::int as meetings
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilter}
            GROUP BY date
            ORDER BY date ASC
            LIMIT 5
        `);
        console.log('Daily Volume Sample:', dailyVolume);

        console.log('\n2. Testing Heatmap Query...');
        const heatmapData = await prisma.$queryRaw(Prisma.sql`
            SELECT 
                TO_CHAR("createdAt", 'FMDay') as day,
                EXTRACT(HOUR FROM "createdAt")::int as hour,
                COUNT(*)::int as count
            FROM "Action"
            WHERE "channel" = 'CALL'
              AND "createdAt" >= ${dateFrom}
              AND "createdAt" <= ${dateTo}
              ${sdrFilter}
            GROUP BY day, hour
            LIMIT 5
        `);
        console.log('Heatmap Sample:', heatmapData);

        console.log('\n3. Testing GroupBy Status...');
        const statusBreakdown = await prisma.action.groupBy({
            by: ['result'],
            where: {
                channel: 'CALL',
                createdAt: { gte: dateFrom, lte: dateTo }
            },
            _count: { id: true },
        });
        console.log('Status Breakdown:', statusBreakdown);

        console.log('\n4. Testing SDR Performance Query...');
        const sdrPerformance = await prisma.$queryRaw(Prisma.sql`
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
            GROUP BY u.id, u."name", u."role"
            ORDER BY calls DESC
            LIMIT 3
        `);
        console.log('SDR Performance:', sdrPerformance);

        console.log('\n5. Testing Mission States Query...');
        const missionStates = await prisma.$queryRaw(Prisma.sql`
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
            GROUP BY m.id, m."name", m."isActive", cl."name"
            HAVING COUNT(a.id) > 0 OR m."isActive" = true
            ORDER BY calls DESC
            LIMIT 3
        `);
        console.log('Mission States:', missionStates);

    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
