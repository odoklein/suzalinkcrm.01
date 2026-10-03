// ============================================
// EMAIL TRACKING PIXEL ROUTE
// GET /api/email/tracking/open - Track email opens
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { emailSendingService } from '@/lib/email/services/sending-service';

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const trackingPixelId = searchParams.get('id');

    if (trackingPixelId) {
        // Record the open asynchronously (don't block response)
        const metadata = {
            ipAddress: req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
        };

        // Fire and forget
        emailSendingService.recordOpen(trackingPixelId, metadata).catch(console.error);
    }

    // Return transparent 1x1 GIF
    return new NextResponse(TRACKING_PIXEL, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    });
}
