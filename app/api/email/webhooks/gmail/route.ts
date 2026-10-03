// ============================================
// GMAIL PUSH NOTIFICATION WEBHOOK
// POST /api/email/webhooks/gmail
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailSyncService } from '@/lib/email/services/sync-service';
import { scheduleEmailSync } from '@/lib/email/queue';

// ============================================
// POST - Handle Gmail Push Notification
// ============================================

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Gmail sends notifications in this format:
        // {
        //   "message": {
        //     "data": "base64 encoded JSON",
        //     "messageId": "...",
        //     "publishTime": "..."
        //   },
        //   "subscription": "projects/.../subscriptions/..."
        // }

        if (!body.message?.data) {
            return NextResponse.json(
                { success: false, error: 'Invalid payload' },
                { status: 400 }
            );
        }

        // Decode the base64 data
        const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
        const notification = JSON.parse(decodedData);

        // Notification contains:
        // {
        //   "emailAddress": "user@gmail.com",
        //   "historyId": "12345"
        // }

        const { emailAddress, historyId } = notification;

        if (!emailAddress) {
            return NextResponse.json(
                { success: false, error: 'Missing email address' },
                { status: 400 }
            );
        }

        console.log(`[Gmail Webhook] Notification for ${emailAddress}, historyId: ${historyId}`);

        // Find the mailbox by email
        const mailbox = await prisma.mailbox.findFirst({
            where: {
                email: emailAddress,
                provider: 'GMAIL',
                isActive: true,
            },
            select: {
                id: true,
                ownerId: true,
            },
        });

        if (!mailbox) {
            console.log(`[Gmail Webhook] No mailbox found for ${emailAddress}`);
            // Still return 200 to acknowledge the notification
            return NextResponse.json({ success: true, skipped: true });
        }

        // Queue a sync job for this mailbox
        // The sync service will use the historyId for incremental sync
        await scheduleEmailSync({
            mailboxId: mailbox.id,
            userId: mailbox.ownerId,
            fullSync: false,
            maxThreads: 50, // Limit for webhook-triggered syncs
        });

        console.log(`[Gmail Webhook] Sync queued for mailbox ${mailbox.id}`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Gmail Webhook] Error:', error);
        // Return 200 anyway to avoid retries for processing errors
        return NextResponse.json({ success: false, error: 'Processing error' });
    }
}

// ============================================
// GET - Verification endpoint (if needed)
// ============================================

export async function GET(req: NextRequest) {
    // Google may send verification requests
    const { searchParams } = new URL(req.url);
    const challenge = searchParams.get('challenge');
    
    if (challenge) {
        return new NextResponse(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    return NextResponse.json({ status: 'ok', provider: 'gmail' });
}
