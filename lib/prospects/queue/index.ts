// ============================================
// PROSPECT PROCESSING QUEUE
// Background job processing with BullMQ
// ============================================

import { Queue, Job } from 'bullmq';
import { REDIS_CONFIG } from '@/lib/email/queue/index';

// Re-export REDIS_CONFIG for convenience
export { REDIS_CONFIG };

// ============================================
// QUEUE NAMES
// ============================================

export const PROSPECT_QUEUE_NAMES = {
  PROCESSING: 'prospect-processing',
  ENRICHMENT: 'prospect-enrichment',
  ACTIVATION: 'prospect-activation',
  DEDUPLICATION: 'prospect-deduplication',
} as const;

// ============================================
// JOB DATA TYPES
// ============================================

export interface ProcessProspectEventJobData {
  eventId: string;
}

export interface EnrichProspectJobData {
  profileId: string;
}

export interface ActivateProspectJobData {
  profileId: string;
}

export interface CheckDuplicatesJobData {
  profileId: string;
}

// ============================================
// QUEUE STORE
// ============================================

const queues: Map<string, Queue> = new Map();

// ============================================
// GET QUEUE
// ============================================

export function getProspectQueue<T = any>(name: string): Queue<T> {
  if (!queues.has(name)) {
    const queue = new Queue<T>(name, {
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

export function getProspectProcessingQueue(): Queue<ProcessProspectEventJobData> {
  return getProspectQueue<ProcessProspectEventJobData>(PROSPECT_QUEUE_NAMES.PROCESSING);
}

export function getProspectEnrichmentQueue(): Queue<EnrichProspectJobData> {
  return getProspectQueue<EnrichProspectJobData>(PROSPECT_QUEUE_NAMES.ENRICHMENT);
}

export function getProspectActivationQueue(): Queue<ActivateProspectJobData> {
  return getProspectQueue<ActivateProspectJobData>(PROSPECT_QUEUE_NAMES.ACTIVATION);
}

export function getProspectDeduplicationQueue(): Queue<CheckDuplicatesJobData> {
  return getProspectQueue<CheckDuplicatesJobData>(PROSPECT_QUEUE_NAMES.DEDUPLICATION);
}

// ============================================
// SCHEDULE JOBS
// ============================================

export async function scheduleProspectProcessing(eventId: string) {
  const queue = getProspectProcessingQueue();
  await queue.add('process-prospect-event', { eventId });
}

export async function scheduleProspectEnrichment(profileId: string) {
  const queue = getProspectEnrichmentQueue();
  await queue.add('enrich-prospect', { profileId });
}

export async function scheduleProspectActivation(profileId: string) {
  const queue = getProspectActivationQueue();
  await queue.add('activate-prospect', { profileId });
}

export async function scheduleDuplicateCheck(profileId: string) {
  const queue = getProspectDeduplicationQueue();
  await queue.add('check-duplicates', { profileId });
}
