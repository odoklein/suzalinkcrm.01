// ============================================
// EMAIL QUEUE INFRASTRUCTURE
// Background job processing with BullMQ
// ============================================

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// ============================================
// REDIS CONNECTION CONFIG
// ============================================

export const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,
};

/** Connection options that fail fast (no retries) for the one-time Redis check */
const REDIS_CHECK_OPTIONS = {
    ...REDIS_CONFIG,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    connectTimeout: 2000,
    retryStrategy: () => null,
};

// ============================================
// QUEUE NAMES
// ============================================

export const QUEUE_NAMES = {
    EMAIL_SYNC: 'email-sync',
    EMAIL_SEND: 'email-send',
    SEQUENCE_PROCESS: 'sequence-process',
    ANALYTICS_AGGREGATE: 'analytics-aggregate',
    WARMUP_SEND: 'warmup-send',
    AI_ANALYZE: 'ai-analyze',
    DEAD_LETTER: 'email-dead-letter',  // Failed jobs inspection
} as const;

// ============================================
// JOB TYPES
// ============================================

export interface EmailSyncJobData {
    mailboxId: string;
    userId: string;
    fullSync?: boolean;
    maxThreads?: number;
}

export interface EmailSendJobData {
    mailboxId: string;
    threadId?: string;
    to: { email: string; name?: string }[];
    cc?: { email: string; name?: string }[];
    bcc?: { email: string; name?: string }[];
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    attachments?: { filename: string; content: string; mimeType: string }[];
    trackingPixelId?: string;
    inReplyTo?: string;
    sequenceEnrollmentId?: string;
    sequenceStepId?: string;
}

export interface SequenceProcessJobData {
    enrollmentId: string;
}

export interface AnalyticsAggregateJobData {
    mailboxId: string;
    date: string; // YYYY-MM-DD
}

export interface WarmupSendJobData {
    mailboxId: string;
    count: number;
}

export interface AIAnalyzeJobData {
    threadId: string;
    analysisType: 'sentiment' | 'summary' | 'priority' | 'all';
}

// ============================================
// QUEUE FACTORY
// ============================================

let queues: Map<string, Queue> = new Map();
let workers: Map<string, Worker> = new Map();
let isInitialized = false;
let redisAvailable = true;
let redisCheckPromise: Promise<void> | null = null;

/**
 * One-time Redis connectivity check. If Redis is unreachable, sets redisAvailable = false
 * so we never create Queue instances (and avoid ECONNREFUSED retry spam).
 */
export function checkRedisOnce(): Promise<void> {
    if (redisCheckPromise !== null) return redisCheckPromise;
    redisCheckPromise = (async () => {
        const client = new Redis(REDIS_CHECK_OPTIONS as any);
        client.on('error', () => {}); // Prevent unhandled error event on connection failure
        try {
            await client.ping();
        } catch (err) {
            redisAvailable = false;
            console.warn('[Queue] Redis not available (ECONNREFUSED) - queue operations disabled. Start Redis or set REDIS_HOST to use the email queue.');
        } finally {
            client.disconnect();
        }
    })();
    return redisCheckPromise;
}

/**
 * Set Redis availability flag (called by connection monitoring)
 */
export function setRedisAvailable(available: boolean): void {
    redisAvailable = available;
    if (!available) {
        console.warn('[Queue] Redis unavailable - queue operations will fail gracefully');
    } else {
        console.log('[Queue] Redis connection restored');
    }
}

/**
 * Check if Redis is available for queue operations
 */
export function isRedisAvailable(): boolean {
    return redisAvailable;
}

export function getQueue(name: string): Queue {
    if (!redisAvailable) {
        throw new Error(`Queue unavailable: Redis not connected`);
    }

    if (!queues.has(name)) {
        const queue = new Queue(name, {
            connection: REDIS_CONFIG,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: {
                    age: 24 * 3600, // Keep completed jobs for 24 hours
                    count: 1000,
                },
                removeOnFail: {
                    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
                },
            },
        });
        queues.set(name, queue);
    }
    return queues.get(name)!;
}

// ============================================
// SPECIFIC QUEUE GETTERS
// ============================================

export function getEmailSyncQueue(): Queue<EmailSyncJobData> {
    return getQueue(QUEUE_NAMES.EMAIL_SYNC) as Queue<EmailSyncJobData>;
}

export function getEmailSendQueue(): Queue<EmailSendJobData> {
    return getQueue(QUEUE_NAMES.EMAIL_SEND) as Queue<EmailSendJobData>;
}

export function getSequenceProcessQueue(): Queue<SequenceProcessJobData> {
    return getQueue(QUEUE_NAMES.SEQUENCE_PROCESS) as Queue<SequenceProcessJobData>;
}

export function getAnalyticsAggregateQueue(): Queue<AnalyticsAggregateJobData> {
    return getQueue(QUEUE_NAMES.ANALYTICS_AGGREGATE) as Queue<AnalyticsAggregateJobData>;
}

export function getWarmupSendQueue(): Queue<WarmupSendJobData> {
    return getQueue(QUEUE_NAMES.WARMUP_SEND) as Queue<WarmupSendJobData>;
}

export function getAIAnalyzeQueue(): Queue<AIAnalyzeJobData> {
    return getQueue(QUEUE_NAMES.AI_ANALYZE) as Queue<AIAnalyzeJobData>;
}

export interface DeadLetterJobData {
    originalQueue: string;
    originalJob: unknown;
    error: string;
    failedAt: string;
}

export function getDeadLetterQueue(): Queue<DeadLetterJobData> {
    return getQueue(QUEUE_NAMES.DEAD_LETTER) as Queue<DeadLetterJobData>;
}

/**
 * Check if queue has capacity (backpressure prevention)
 */
export async function canScheduleJob(queueName: string): Promise<boolean> {
    try {
        const stats = await getQueueStats(queueName);
        return stats.waiting < 1000; // Reject if queue depth > 1000
    } catch {
        return false; // If we can't check, assume unavailable
    }
}

// ============================================
// JOB SCHEDULERS
// ============================================

export async function scheduleEmailSync(data: EmailSyncJobData): Promise<Job<EmailSyncJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getEmailSyncQueue();
    return queue.add('sync', data, {
        priority: 1,
        jobId: `sync-${data.mailboxId}-${Date.now()}`,
    });
}

export async function scheduleEmailSend(data: EmailSendJobData): Promise<Job<EmailSendJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getEmailSendQueue();

    // Create idempotency key based on content to prevent duplicate sends
    const recipientKey = data.to.map(t => t.email).sort().join(',');
    const subjectKey = (data.subject || '').slice(0, 50);
    const idempotencyHash = Buffer.from(`${data.mailboxId}-${recipientKey}-${subjectKey}`).toString('base64').slice(0, 32);

    return queue.add('send', data, {
        priority: 2,
        jobId: `send-${idempotencyHash}-${Date.now()}`,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 10000, // Start at 10 seconds
        },
    });
}

export async function scheduleSequenceProcess(data: SequenceProcessJobData): Promise<Job<SequenceProcessJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getSequenceProcessQueue();
    return queue.add('process', data, {
        priority: 3,
        jobId: `sequence-${data.enrollmentId}-${Date.now()}`,
    });
}

export async function scheduleAnalyticsAggregate(data: AnalyticsAggregateJobData): Promise<Job<AnalyticsAggregateJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getAnalyticsAggregateQueue();
    return queue.add('aggregate', data, {
        priority: 5,
        jobId: `analytics-${data.mailboxId}-${data.date}`,
    });
}

export async function scheduleWarmupSend(data: WarmupSendJobData): Promise<Job<WarmupSendJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getWarmupSendQueue();
    return queue.add('warmup', data, {
        priority: 4,
        jobId: `warmup-${data.mailboxId}-${Date.now()}`,
    });
}

export async function scheduleAIAnalyze(data: AIAnalyzeJobData): Promise<Job<AIAnalyzeJobData>> {
    await checkRedisOnce();
    if (!redisAvailable) throw new Error(`Queue unavailable: Redis not connected`);
    const queue = getAIAnalyzeQueue();
    return queue.add('analyze', data, {
        priority: 5,
        jobId: `ai-${data.threadId}-${data.analysisType}-${Date.now()}`,
    });
}

// ============================================
// RECURRING JOBS
// ============================================

export async function setupRecurringJobs(): Promise<void> {
    // Daily analytics aggregation at 2 AM
    const analyticsQueue = getAnalyticsAggregateQueue();
    await analyticsQueue.upsertJobScheduler(
        'daily-analytics',
        { pattern: '0 2 * * *' }, // 2 AM daily
        {
            name: 'daily-aggregate',
            data: { mailboxId: 'all', date: 'yesterday' },
        }
    );

    // Check sequence enrollments every 5 minutes
    const sequenceQueue = getSequenceProcessQueue();
    await sequenceQueue.upsertJobScheduler(
        'sequence-check',
        { pattern: '*/5 * * * *' }, // Every 5 minutes
        {
            name: 'check-due',
            data: { enrollmentId: 'all' },
        }
    );

    // Sync all mailboxes every 1 minute
    const syncQueue = getEmailSyncQueue();
    await syncQueue.upsertJobScheduler(
        'email-sync-check',
        { pattern: '* * * * *' }, // Every 1 minute
        {
            name: 'sync-all',
            data: {
                mailboxId: 'all',
                userId: 'system'
            },
        }
    );

    console.log('Email queue recurring jobs set up');
}

// ============================================
// CLEANUP
// ============================================

export async function closeAllQueues(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, queue] of queues) {
        closePromises.push(queue.close().then(() => {
            console.log(`Queue ${name} closed`);
        }));
    }

    for (const [name, worker] of workers) {
        closePromises.push(worker.close().then(() => {
            console.log(`Worker ${name} closed`);
        }));
    }

    await Promise.all(closePromises);
    queues.clear();
    workers.clear();
    isInitialized = false;
}

// ============================================
// QUEUE STATS
// ============================================

export async function getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}> {
    const queue = getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
}

export async function getAllQueueStats(): Promise<Record<string, {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}>> {
    const stats: Record<string, Awaited<ReturnType<typeof getQueueStats>>> = {};

    for (const queueName of Object.values(QUEUE_NAMES)) {
        stats[queueName] = await getQueueStats(queueName);
    }

    return stats;
}
