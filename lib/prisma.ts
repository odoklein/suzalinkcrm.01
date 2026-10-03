import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    prismaDirect: PrismaClient | undefined;
};

/** Keep pool small to avoid P2024 (connection pool timeout) when DB connection limit is low or many workers run. */
const CONNECTION_LIMIT = 5;
const POOL_TIMEOUT = 20;

function poolUrl(url: string | undefined): string | undefined {
    if (!url) return url;
    const hasParams = url.includes("?");
    const params: string[] = [];
    if (!url.includes("connection_limit=")) params.push(`connection_limit=${CONNECTION_LIMIT}`);
    if (!url.includes("pool_timeout=")) params.push(`pool_timeout=${POOL_TIMEOUT}`);
    if (params.length === 0) return url;
    return url + (hasParams ? "&" : "?") + params.join("&");
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: process.env.DATABASE_URL ? { db: { url: poolUrl(process.env.DATABASE_URL) } } : undefined,
});

/** Uses DIRECT_URL (session mode) for operations requiring transactional consistency (e.g. CSV import).
 * Prevents P2003 FK violations when pooler transaction mode (6543) causes read-your-writes issues. */
export const prismaDirect = globalForPrisma.prismaDirect ?? new PrismaClient({
    datasources: process.env.DIRECT_URL
        ? { db: { url: poolUrl(process.env.DIRECT_URL) } }
        : undefined,
});

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaDirect = prismaDirect;
}

export default prisma;
