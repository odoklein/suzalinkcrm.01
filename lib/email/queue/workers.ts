// ============================================
// EMAIL QUEUE WORKERS
// Background job processors
// ============================================

import { Worker, Job } from 'bullmq';
import {
    REDIS_CONFIG,
    QUEUE_NAMES,
    EmailSyncJobData,
    EmailSendJobData,
    SequenceProcessJobData,
    AnalyticsAggregateJobData,
    AIAnalyzeJobData,
    getDeadLetterQueue,
} from './index';
import { emailSyncService } from '../services/sync-service';
import { prisma } from '@/lib/prisma';
import { canExecute, recordSuccess, recordFailure } from '../utils/circuit-breaker';
import { classifyError } from '../utils/error-taxonomy';

// ============================================
// WORKER STORE
// ============================================

const workers: Map<string, Worker> = new Map();

// ============================================
// EMAIL SYNC WORKER
// ============================================

export function createEmailSyncWorker(): Worker<EmailSyncJobData> {
    const worker = new Worker<EmailSyncJobData>(
        QUEUE_NAMES.EMAIL_SYNC,
        async (job: Job<EmailSyncJobData>) => {
            const { mailboxId, fullSync, maxThreads } = job.data;

            // Handle "sync all" job
            if (mailboxId === 'all') {
                const mailboxes = await prisma.mailbox.findMany({
                    where: { isActive: true },
                    select: { id: true, ownerId: true }
                });

                console.log(`[EmailSync] Scheduling sync for ${mailboxes.length} mailboxes`);

                const { scheduleEmailSync } = await import('./index');
                for (const mb of mailboxes) {
                    await scheduleEmailSync({
                        mailboxId: mb.id,
                        userId: mb.ownerId,
                        fullSync: false
                    });
                }

                return { processed: mailboxes.length };
            }

            // Circuit breaker check - fail fast if mailbox is in failure state
            if (!canExecute(mailboxId)) {
                console.warn(`[EmailSync] Circuit open for mailbox ${mailboxId}, skipping`);
                throw new Error(`Circuit open for mailbox ${mailboxId} - too many recent failures`);
            }

            console.log(`[EmailSync] Processing job ${job.id} for mailbox ${mailboxId}`);

            try {
                const result = await emailSyncService.syncMailbox(mailboxId, {
                    fullSync,
                    maxThreads,
                });

                if (!result.success) {
                    recordFailure(mailboxId);
                    throw new Error(result.errors.join(', '));
                }

                // Success - reset circuit breaker
                recordSuccess(mailboxId);

                return {
                    threadsProcessed: result.threadsProcessed,
                    messagesProcessed: result.messagesProcessed,
                    duration: result.duration,
                };
            } catch (error) {
                recordFailure(mailboxId);
                throw error;
            }
        },
        {
            connection: REDIS_CONFIG,
            concurrency: 1,  // Serialize to prevent rate limit issues with providers
            limiter: {
                max: 2,       // Max 2 syncs per second globally
                duration: 1000,
            },
        }
    );

    worker.on('completed', (job, result) => {
        console.log(`[EmailSync] Job ${job.id} completed:`, result);
    });

    worker.on('failed', async (job, error) => {
        console.error(`[EmailSync] Job ${job?.id} failed:`, error);

        // Move to dead letter queue after max retries
        if (job && job.attemptsMade >= 3) {
            try {
                const dlq = getDeadLetterQueue();
                await dlq.add('failed-sync', {
                    originalQueue: QUEUE_NAMES.EMAIL_SYNC,
                    originalJob: job.data,
                    error: error.message,
                    failedAt: new Date().toISOString(),
                });
                console.warn(`[EmailSync] Job ${job.id} moved to dead letter queue`);
            } catch (dlqError) {
                console.error('[EmailSync] Failed to add to dead letter queue:', dlqError);
            }
        }
    });

    workers.set(QUEUE_NAMES.EMAIL_SYNC, worker);
    return worker;
}

// ============================================
// EMAIL SEND WORKER
// ============================================

export function createEmailSendWorker(): Worker<EmailSendJobData> {
    const worker = new Worker<EmailSendJobData>(
        QUEUE_NAMES.EMAIL_SEND,
        async (job: Job<EmailSendJobData>) => {
            console.log(`Processing email send job: ${job.id}`);

            const {
                mailboxId,
                to,
                cc,
                bcc,
                subject,
                bodyHtml,
                bodyText,
                trackingPixelId,
                inReplyTo,
                threadId,
                sequenceEnrollmentId,
                sequenceStepId,
            } = job.data;

            // Import sending service dynamically to avoid circular deps
            const { emailSendingService } = await import('../services/sending-service');

            const result = await emailSendingService.sendEmail(mailboxId, {
                to,
                cc,
                bcc,
                subject,
                bodyHtml,
                bodyText,
                trackingPixelId,
                inReplyTo,
                threadId,
            });

            if (!result.success) {
                throw new Error(result.error || 'Send failed');
            }

            // Update sequence enrollment if applicable
            if (sequenceEnrollmentId && sequenceStepId) {
                await prisma.emailSequenceStep.update({
                    where: { id: sequenceStepId },
                    data: { totalSent: { increment: 1 } },
                });
            }

            return {
                messageId: result.messageId,
                threadId: result.threadId,
            };
        },
        {
            connection: REDIS_CONFIG,
            concurrency: 3,
            limiter: {
                max: 5,
                duration: 1000, // Max 5 sends per second
            },
        }
    );

    worker.on('completed', (job, result) => {
        console.log(`Email send job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        console.error(`Email send job ${job?.id} failed:`, error);
    });

    workers.set(QUEUE_NAMES.EMAIL_SEND, worker);
    return worker;
}

// ============================================
// SEQUENCE PROCESS WORKER
// ============================================

export function createSequenceProcessWorker(): Worker<SequenceProcessJobData> {
    const worker = new Worker<SequenceProcessJobData>(
        QUEUE_NAMES.SEQUENCE_PROCESS,
        async (job: Job<SequenceProcessJobData>) => {
            console.log(`Processing sequence job: ${job.id}`);

            const { enrollmentId } = job.data;

            // Handle "check all due" job
            if (enrollmentId === 'all') {
                const dueEnrollments = await prisma.emailSequenceEnrollment.findMany({
                    where: {
                        status: 'ACTIVE',
                        nextStepAt: { lte: new Date() },
                    },
                    take: 100,
                });

                // Schedule individual jobs
                const { scheduleSequenceProcess } = await import('./index');
                for (const enrollment of dueEnrollments) {
                    await scheduleSequenceProcess({ enrollmentId: enrollment.id });
                }

                return { processed: dueEnrollments.length };
            }

            // Process single enrollment
            const { sequenceService } = await import('../services/sequence-service');
            const result = await sequenceService.processEnrollment(enrollmentId);

            return result;
        },
        {
            connection: REDIS_CONFIG,
            concurrency: 10,
        }
    );

    worker.on('completed', (job, result) => {
        console.log(`Sequence job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        console.error(`Sequence job ${job?.id} failed:`, error);
    });

    workers.set(QUEUE_NAMES.SEQUENCE_PROCESS, worker);
    return worker;
}

// ============================================
// ANALYTICS AGGREGATE WORKER
// ============================================

export function createAnalyticsAggregateWorker(): Worker<AnalyticsAggregateJobData> {
    const worker = new Worker<AnalyticsAggregateJobData>(
        QUEUE_NAMES.ANALYTICS_AGGREGATE,
        async (job: Job<AnalyticsAggregateJobData>) => {
            console.log(`Processing analytics job: ${job.id}`);

            const { mailboxId, date } = job.data;

            // Calculate the actual date
            let targetDate: Date;
            if (date === 'yesterday') {
                targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - 1);
            } else {
                targetDate = new Date(date);
            }
            targetDate.setHours(0, 0, 0, 0);

            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

            // Get mailboxes to process
            const mailboxes = mailboxId === 'all'
                ? await prisma.mailbox.findMany({ where: { isActive: true }, select: { id: true } })
                : [{ id: mailboxId }];

            let processed = 0;

            for (const mb of mailboxes) {
                // Aggregate email stats for the day
                const stats = await prisma.email.groupBy({
                    by: ['status'],
                    where: {
                        mailboxId: mb.id,
                        createdAt: {
                            gte: targetDate,
                            lt: nextDay,
                        },
                    },
                    _count: true,
                });

                const sent = stats.find(s => s.status === 'SENT')?._count || 0;
                const delivered = stats.find(s => s.status === 'DELIVERED')?._count || 0;
                const opened = stats.find(s => s.status === 'OPENED')?._count || 0;
                const clicked = stats.find(s => s.status === 'CLICKED')?._count || 0;
                const replied = stats.find(s => s.status === 'REPLIED')?._count || 0;
                const bounced = stats.find(s => s.status === 'BOUNCED')?._count || 0;

                // Upsert analytics record
                await prisma.emailAnalyticsDaily.upsert({
                    where: {
                        mailboxId_date: {
                            mailboxId: mb.id,
                            date: targetDate,
                        },
                    },
                    create: {
                        mailboxId: mb.id,
                        date: targetDate,
                        sent,
                        delivered,
                        opened,
                        uniqueOpened: opened, // Simplified for now
                        clicked,
                        replied,
                        bounced,
                    },
                    update: {
                        sent,
                        delivered,
                        opened,
                        uniqueOpened: opened,
                        clicked,
                        replied,
                        bounced,
                    },
                });

                processed++;
            }

            return { processed, date: targetDate.toISOString().split('T')[0] };
        },
        {
            connection: REDIS_CONFIG,
            concurrency: 2,
        }
    );

    worker.on('completed', (job, result) => {
        console.log(`Analytics job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        console.error(`Analytics job ${job?.id} failed:`, error);
    });

    workers.set(QUEUE_NAMES.ANALYTICS_AGGREGATE, worker);
    return worker;
}

// ============================================
// AI ANALYZE WORKER
// ============================================

export function createAIAnalyzeWorker(): Worker<AIAnalyzeJobData> {
    const worker = new Worker<AIAnalyzeJobData>(
        QUEUE_NAMES.AI_ANALYZE,
        async (job: Job<AIAnalyzeJobData>) => {
            console.log(`Processing AI analysis job: ${job.id}`);

            const { threadId, analysisType } = job.data;

            // Get thread with emails
            const thread = await prisma.emailThread.findUnique({
                where: { id: threadId },
                include: {
                    emails: {
                        orderBy: { receivedAt: 'asc' },
                        select: {
                            bodyText: true,
                            bodyHtml: true,
                            fromAddress: true,
                            direction: true,
                        },
                    },
                },
            });

            if (!thread) {
                throw new Error('Thread not found');
            }

            // Placeholder for AI analysis - would integrate with OpenAI
            const updates: Record<string, string | null> = {};

            if (analysisType === 'sentiment' || analysisType === 'all') {
                // Simplified sentiment analysis placeholder
                updates.sentiment = 'neutral';
            }

            if (analysisType === 'priority' || analysisType === 'all') {
                // Simplified priority classification placeholder
                updates.priority = 'medium';
            }

            if (analysisType === 'summary' || analysisType === 'all') {
                // Simplified summary placeholder
                const lastEmail = thread.emails[thread.emails.length - 1];
                updates.summary = lastEmail?.bodyText?.substring(0, 200) || null;
            }

            // Update thread
            await prisma.emailThread.update({
                where: { id: threadId },
                data: updates,
            });

            return { threadId, analysisType, updates };
        },
        {
            connection: REDIS_CONFIG,
            concurrency: 5,
        }
    );

    worker.on('completed', (job, result) => {
        console.log(`AI analysis job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        console.error(`AI analysis job ${job?.id} failed:`, error);
    });

    workers.set(QUEUE_NAMES.AI_ANALYZE, worker);
    return worker;
}

// ============================================
// START ALL WORKERS
// ============================================

export function startAllWorkers(): void {
    console.log('Starting email queue workers...');

    createEmailSyncWorker();
    createEmailSendWorker();
    createSequenceProcessWorker();
    createAnalyticsAggregateWorker();
    createAIAnalyzeWorker();

    console.log('All email queue workers started');
}

// ============================================
// STOP ALL WORKERS
// ============================================

export async function stopAllWorkers(): Promise<void> {
    console.log('Stopping email queue workers...');

    const closePromises: Promise<void>[] = [];

    for (const [name, worker] of workers) {
        closePromises.push(
            worker.close().then(() => {
                console.log(`Worker ${name} stopped`);
            })
        );
    }

    await Promise.all(closePromises);
    workers.clear();

    console.log('All email queue workers stopped');
}
