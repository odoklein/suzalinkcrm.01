// ============================================
// PROSPECT INTAKE SERVICE
// Handles incoming leads from external sources
// ============================================

import { prisma } from '@/lib/prisma';
import { ProspectSourceType, ProspectPipelineStep, ProspectStatus } from '@prisma/client';
import { scheduleProspectProcessing } from './queue';

export interface IntakePayload {
  [key: string]: any; // Flexible JSON payload
}

export interface IntakeResult {
  eventId: string;
  profileId: string | null;
  success: boolean;
  error?: string;
}

// ============================================
// INTAKE LEAD
// ============================================

export async function intakeLead(
  sourceId: string,
  payload: IntakePayload,
  processedBy?: string
): Promise<IntakeResult> {
  try {
    // Verify source exists and is active
    const source = await prisma.prospectSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      throw new Error(`Prospect source ${sourceId} not found`);
    }

    if (!source.isActive) {
      throw new Error(`Prospect source ${sourceId} is not active`);
    }

    // Create immutable event (append-only)
    const event = await prisma.prospectEvent.create({
      data: {
        sourceId,
        rawPayload: payload as any,
        eventType: 'intake',
        step: ProspectPipelineStep.INTAKE,
        processedBy: processedBy || 'system',
      },
    });

    // Create or update prospect profile from event
    // For now, we'll create a basic profile - normalization happens in pipeline
    const profile = await createOrUpdateProfileFromEvent(event.id, payload);

    // Link event to profile
    await prisma.prospectEvent.update({
      where: { id: event.id },
      data: { profileId: profile.id },
    });

    // Schedule processing through pipeline
    await scheduleProspectProcessing(event.id);

    return {
      eventId: event.id,
      profileId: profile.id,
      success: true,
    };
  } catch (error: any) {
    console.error('Intake error:', error);
    return {
      eventId: '',
      profileId: null,
      success: false,
      error: error.message || 'Intake failed',
    };
  }
}

// ============================================
// CREATE OR UPDATE PROFILE FROM EVENT
// ============================================

async function createOrUpdateProfileFromEvent(
  eventId: string,
  payload: IntakePayload
) {
  // Extract basic fields (normalization will happen in pipeline)
  const email = extractField(payload, ['email', 'Email', 'EMAIL', 'e-mail']);
  const firstName = extractField(payload, ['firstName', 'first_name', 'firstname', 'First Name', 'FIRST_NAME']);
  const lastName = extractField(payload, ['lastName', 'last_name', 'lastname', 'Last Name', 'LAST_NAME']);
  const phone = extractField(payload, ['phone', 'Phone', 'PHONE', 'telephone', 'tel']);
  const companyName = extractField(payload, ['company', 'companyName', 'company_name', 'Company', 'COMPANY']);
  const title = extractField(payload, ['title', 'Title', 'TITLE', 'jobTitle', 'job_title', 'position']);

  // Check if profile already exists (by email if available)
  let profile = null;
  if (email) {
    profile = await prisma.prospectProfile.findUnique({
      where: { email },
    });
  }

  if (profile) {
    // Update existing profile with new data
    profile = await prisma.prospectProfile.update({
      where: { id: profile.id },
      data: {
        firstName: firstName || profile.firstName,
        lastName: lastName || profile.lastName,
        phone: phone || profile.phone,
        companyName: companyName || profile.companyName,
        title: title || profile.title,
        customFields: {
          ...((profile.customFields as any) || {}),
          ...payload, // Merge all payload data into customFields
        },
        updatedAt: new Date(),
      },
    });
  } else {
    // Create new profile
    profile = await prisma.prospectProfile.create({
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        companyName: companyName || null,
        title: title || null,
        customFields: payload as any,
        currentStep: ProspectPipelineStep.INTAKE,
        status: ProspectStatus.PENDING,
      },
    });
  }

  return profile;
}

// ============================================
// HELPER: EXTRACT FIELD FROM PAYLOAD
// ============================================

function extractField(
  payload: IntakePayload,
  possibleKeys: string[]
): string | null {
  for (const key of possibleKeys) {
    const value = payload[key];
    if (value && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}
