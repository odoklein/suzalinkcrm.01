import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// ============================================
// GET /api/permissions - List all permissions
// ============================================

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where = category ? { category } : {};

    const permissions = await prisma.permission.findMany({
        where,
        orderBy: [
            { category: 'asc' },
            { name: 'asc' },
        ],
    });

    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
        if (!acc[perm.category]) {
            acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, typeof permissions>);

    return successResponse({
        permissions,
        grouped,
    });
});
