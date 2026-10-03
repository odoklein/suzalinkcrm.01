import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scheduleEmailSync, checkRedisOnce, isRedisAvailable } from '@/lib/email/queue';
import { emailSyncService } from '@/lib/email/services/sync-service';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        // Get all active mailboxes for the user
        const mailboxes = await prisma.mailbox.findMany({
            where: {
                ownerId: session.user.id,
                isActive: true,
            },
            select: { id: true }
        });

        if (mailboxes.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'Aucune boîte mail active trouvée',
                count: 0
            });
        }

        await checkRedisOnce();

        if (isRedisAvailable()) {
            // Schedule sync via queue
            let scheduledCount = 0;
            for (const mb of mailboxes) {
                try {
                    await scheduleEmailSync({
                        mailboxId: mb.id,
                        userId: session.user.id,
                        fullSync: false
                    });
                    scheduledCount++;
                } catch (err) {
                    console.error(`Failed to schedule sync for mailbox ${mb.id}:`, err);
                }
            }
            return NextResponse.json({
                success: true,
                message: 'Synchronisation lancée',
                count: scheduledCount
            });
        }

        // Redis unavailable: run sync inline (no queue)
        let syncedCount = 0;
        for (const mb of mailboxes) {
            try {
                const result = await emailSyncService.syncMailbox(mb.id, { fullSync: false });
                if (result.success) syncedCount++;
            } catch (err) {
                console.error(`Inline sync failed for mailbox ${mb.id}:`, err);
            }
        }
        return NextResponse.json({
            success: true,
            message: 'Synchronisation effectuée (sans file d’attente — Redis indisponible)',
            count: syncedCount,
            queueDisabled: true
        });
    } catch (error) {
        console.error('POST /api/email/sync error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
