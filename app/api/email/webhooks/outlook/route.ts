// ============================================
// OUTLOOK/MICROSOFT GRAPH WEBHOOK
// POST /api/email/webhooks/outlook
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scheduleEmailSync } from '@/lib/email/queue';

// ============================================
// POST - Handle Microsoft Graph Change Notification
// ============================================

export async function POST(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    
    // Microsoft sends a validation request when creating subscriptions
    const validationToken = searchParams.get('validationToken');
    if (validationToken) {
        console.log('[Outlook Webhook] Validation request received');
        return new NextResponse(validationToken, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    try {
        const body = await req.json();
        
        // Microsoft Graph sends notifications in this format:
        // {
        //   "value": [
        //     {
        //       "subscriptionId": "...",
        //       "subscriptionExpirationDateTime": "...",
        //       "changeType": "created" | "updated" | "deleted",
        //       "resource": "Users/{userId}/messages/{messageId}",
        //       "resourceData": {
        //         "@odata.type": "#Microsoft.Graph.Message",
        //         "@odata.id": "...",
        //         "@odata.etag": "...",
        //         "id": "..."
        //       },
        //       "clientState": "...",
        //       "tenantId": "..."
        //     }
        //   ]
        // }

        if (!body.value || !Array.isArray(body.value)) {
            return NextResponse.json(
                { success: false, error: 'Invalid payload' },
                { status: 400 }
            );
        }

        const processedMailboxes = new Set<string>();

        for (const notification of body.value) {
            const { subscriptionId, changeType, resource, clientState } = notification;

            console.log(`[Outlook Webhook] Notification: ${changeType} on ${resource}`);

            // The clientState typically contains our custom identifier
            // We store the mailbox ID in clientState when creating the subscription
            const mailboxId = clientState;

            if (!mailboxId) {
                // Try to find mailbox by subscriptionId if we stored it
                continue;
            }

            // Avoid processing the same mailbox multiple times in one batch
            if (processedMailboxes.has(mailboxId)) {
                continue;
            }

            // Verify the mailbox exists
            const mailbox = await prisma.mailbox.findUnique({
                where: { id: mailboxId },
                select: {
                    id: true,
                    ownerId: true,
                    isActive: true,
                    provider: true,
                },
            });

            if (!mailbox || !mailbox.isActive || mailbox.provider !== 'OUTLOOK') {
                continue;
            }

            // Queue a sync job
            await scheduleEmailSync({
                mailboxId: mailbox.id,
                userId: mailbox.ownerId,
                fullSync: false,
                maxThreads: 50,
            });

            processedMailboxes.add(mailboxId);
            console.log(`[Outlook Webhook] Sync queued for mailbox ${mailbox.id}`);
        }

        return NextResponse.json({ 
            success: true, 
            processed: processedMailboxes.size 
        });
    } catch (error) {
        console.error('[Outlook Webhook] Error:', error);
        // Return 202 to acknowledge receipt even if processing failed
        return NextResponse.json(
            { success: false, error: 'Processing error' },
            { status: 202 }
        );
    }
}

// ============================================
// GET - Health check
// ============================================

export async function GET() {
    return NextResponse.json({ status: 'ok', provider: 'outlook' });
}
