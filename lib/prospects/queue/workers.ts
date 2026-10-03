// ============================================
// PROSPECT QUEUE WORKERS
// Background job processors
// ============================================

import { Worker, Job } from 'bullmq';
import {
  REDIS_CONFIG,
  PROSPECT_QUEUE_NAMES,
  ProcessProspectEventJobData,
  EnrichProspectJobData,
  ActivateProspectJobData,
  CheckDuplicatesJobData,
} from './index';
import { processProfile } from '../pipeline-service';
import { prisma } from '@/lib/prisma';
import { ProspectPipelineStep, ProspectStatus } from '@prisma/client';

// ============================================
// WORKER STORE
// ============================================

const workers: Map<string, Worker> = new Map();

// ============================================
// PROSPECT PROCESSING WORKER
// ============================================

export function createProspectProcessingWorker(): Worker<ProcessProspectEventJobData> {
  const worker = new Worker<ProcessProspectEventJobData>(
    PROSPECT_QUEUE_NAMES.PROCESSING,
    async (job: Job<ProcessProspectEventJobData>) => {
      console.log(`Processing prospect event: ${job.id}`);

      const { eventId } = job.data;

      // Get event and profile
      const event = await prisma.prospectEvent.findUnique({
        where: { id: eventId },
        include: { profile: true },
      });

      if (!event || !event.profile) {
        throw new Error(`Event ${eventId} or profile not found`);
      }

      // Process profile through pipeline
      await processProfile(event.profile.id);

      return { success: true, profileId: event.profile.id };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Prospect processing job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Prospect processing job ${job?.id} failed:`, error);
  });

  workers.set(PROSPECT_QUEUE_NAMES.PROCESSING, worker);
  return worker;
}

// ============================================
// ENRICHMENT WORKER
// ============================================

export function createProspectEnrichmentWorker(): Worker<EnrichProspectJobData> {
  const worker = new Worker<EnrichProspectJobData>(
    PROSPECT_QUEUE_NAMES.ENRICHMENT,
    async (job: Job<EnrichProspectJobData>) => {
      console.log(`Enriching prospect: ${job.id}`);

      const { profileId } = job.data;

      // TODO: Implement enrichment with external APIs (Clearbit, Apollo, etc.)
      // For now, just mark as processed
      await prisma.prospectProfile.update({
        where: { id: profileId },
        data: {
          currentStep: ProspectPipelineStep.ENRICH,
        },
      });

      return { success: true, profileId };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 3,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Enrichment job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Enrichment job ${job?.id} failed:`, error);
  });

  workers.set(PROSPECT_QUEUE_NAMES.ENRICHMENT, worker);
  return worker;
}

// ============================================
// ACTIVATION WORKER
// ============================================

export function createProspectActivationWorker(): Worker<ActivateProspectJobData> {
  const worker = new Worker<ActivateProspectJobData>(
    PROSPECT_QUEUE_NAMES.ACTIVATION,
    async (job: Job<ActivateProspectJobData>) => {
      console.log(`Activating prospect: ${job.id}`);

      const { profileId } = job.data;

      // Activate prospect (create Contact/Company)
      const { activateProspect } = await import('../activation-service');
      await activateProspect(profileId);

      return { success: true, profileId };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 2,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Activation job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Activation job ${job?.id} failed:`, error);
  });

  workers.set(PROSPECT_QUEUE_NAMES.ACTIVATION, worker);
  return worker;
}

// ============================================
// DEDUPLICATION WORKER
// ============================================

export function createProspectDeduplicationWorker(): Worker<CheckDuplicatesJobData> {
  const worker = new Worker<CheckDuplicatesJobData>(
    PROSPECT_QUEUE_NAMES.DEDUPLICATION,
    async (job: Job<CheckDuplicatesJobData>) => {
      console.log(`Checking duplicates for prospect: ${job.id}`);

      const { profileId } = job.data;

      const profile = await prisma.prospectProfile.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new Error(`Profile ${profileId} not found`);
      }

      // Check for duplicates by email or phone
      let duplicate: any = null;

      if (profile.email) {
        duplicate = await prisma.prospectProfile.findFirst({
          where: {
            email: profile.email,
            id: { not: profileId },
            status: { not: ProspectStatus.DUPLICATE },
          },
        });
      }

      if (!duplicate && profile.phone) {
        duplicate = await prisma.contact.findFirst({
          where: {
            phone: profile.phone,
          },
        });
      }

      if (duplicate) {
        // Mark as duplicate
        await prisma.prospectProfile.update({
          where: { id: profileId },
          data: {
            status: ProspectStatus.DUPLICATE,
            duplicateOfId: duplicate.id,
            currentStep: ProspectPipelineStep.DEDUPLICATE,
          },
        });

        return { success: true, duplicate: true, duplicateOf: duplicate.id };
      }

      // No duplicate found, continue
      await prisma.prospectProfile.update({
        where: { id: profileId },
        data: {
          currentStep: ProspectPipelineStep.DEDUPLICATE,
        },
      });

      return { success: true, duplicate: false };
    },
    {
      connection: REDIS_CONFIG,
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`Deduplication job ${job.id} completed:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Deduplication job ${job?.id} failed:`, error);
  });

  workers.set(PROSPECT_QUEUE_NAMES.DEDUPLICATION, worker);
  return worker;
}

// ============================================
// INITIALIZE ALL WORKERS
// ============================================

export function initializeProspectWorkers() {
  createProspectProcessingWorker();
  createProspectEnrichmentWorker();
  createProspectActivationWorker();
  createProspectDeduplicationWorker();
  console.log('Prospect queue workers initialized');
}

// ============================================
// CLOSE ALL WORKERS
// ============================================

export async function closeProspectWorkers() {
  await Promise.all(Array.from(workers.values()).map(worker => worker.close()));
  workers.clear();
}
