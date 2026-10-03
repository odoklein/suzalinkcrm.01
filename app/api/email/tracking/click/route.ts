// ============================================
// EMAIL LINK CLICK TRACKING ROUTE
// GET /api/email/tracking/click - Track link clicks and redirect
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const emailId = searchParams.get('eid');
    const linkId = searchParams.get('lid');
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // Decode the URL
    let targetUrl: string;
    try {
        targetUrl = decodeURIComponent(url);
        // Validate URL
        new URL(targetUrl);
    } catch {
        return NextResponse.redirect(new URL('/', req.url));
    }

    // Record the click asynchronously
    if (emailId) {
        const metadata = {
            linkId,
            url: targetUrl,
            ipAddress: req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
            clickedAt: new Date().toISOString(),
        };

        // Fire and forget - update click count, preserve higher-priority statuses
        prisma.email.findUnique({ where: { id: emailId } }).then((email) => {
            if (!email) return;
            const newStatus =
                email.status === 'REPLIED' || email.status === 'BOUNCED'
                    ? email.status
                    : 'CLICKED';
            return prisma.email.update({
                where: { id: emailId },
                data: {
                    clickCount: { increment: 1 },
                    status: newStatus,
                },
            });
        }).catch(console.error);

        // Also log to audit if needed
        prisma.emailAuditLog.create({
            data: {
                userId: 'system',
                action: 'link_clicked',
                resourceType: 'Email',
                resourceId: emailId,
                metadata: metadata as any,
            },
        }).catch(console.error);
    }

    // Redirect to the target URL
    return NextResponse.redirect(targetUrl);
}
