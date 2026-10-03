import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import {
    successResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

export const POST = withErrorHandler(async (request: NextRequest) => {
    const session = await requireRole(['CLIENT'], request);
    const clientId = (session.user as { clientId?: string }).clientId;
    if (!clientId) throw new Error('Client ID not found');

    const body = await request.json();
    const { missionId, dateFrom, dateTo } = body;

    if (!dateFrom || !dateTo) throw new Error('dateFrom and dateTo are required');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const link = await prisma.sharedReportLink.create({
        data: {
            token,
            clientId,
            missionId: missionId || null,
            dateFrom: new Date(dateFrom),
            dateTo: new Date(dateTo),
            expiresAt,
        },
    });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/shared/report/${token}`;

    return successResponse({ url: shareUrl, token: link.token, expiresAt: link.expiresAt });
});
