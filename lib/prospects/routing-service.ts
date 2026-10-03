// ============================================
// PROSPECT ROUTING SERVICE
// Assigns prospects to missions and SDRs
// ============================================

import { prisma } from '@/lib/prisma';
import { ProspectProfile } from '@prisma/client';

export interface RoutingResult {
  missionId: string | null;
  sdrId: string | null;
  reason: string;
}

// ============================================
// ROUTE PROSPECT
// ============================================

export async function routeProspect(profileId: string): Promise<RoutingResult> {
  const profile = await prisma.prospectProfile.findUnique({
    where: { id: profileId },
    include: {
      source: {
        include: {
          defaultMission: true,
        },
      },
    },
  });

  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  // Check if already assigned
  if (profile.assignedMissionId) {
    return {
      missionId: profile.assignedMissionId,
      sdrId: profile.assignedSdrId,
      reason: 'Already assigned',
    };
  }

  // Try to get mission from source default
  let missionId: string | null = null;
  if (profile.source?.defaultMissionId) {
    missionId = profile.source.defaultMissionId;
  }

  // TODO: Apply routing rules (e.g., by industry, country, etc.)
  // For now, use default mission from source

  // If no mission found, return null (requires manual assignment)
  if (!missionId) {
    return {
      missionId: null,
      sdrId: null,
      reason: 'No default mission configured',
    };
  }

  // Assign SDR using round-robin or load balancing
  const sdrId = await assignSDR(missionId);

  // Update profile
  await prisma.prospectProfile.update({
    where: { id: profileId },
    data: {
      assignedMissionId: missionId,
      assignedSdrId: sdrId,
    },
  });

  return {
    missionId,
    sdrId,
    reason: `Assigned to mission and SDR`,
  };
}

// ============================================
// ASSIGN SDR
// ============================================

async function assignSDR(missionId: string): Promise<string | null> {
  // Get SDRs assigned to this mission
  const assignments = await prisma.sDRAssignment.findMany({
    where: { missionId },
    include: {
      sdr: {
        where: { isActive: true, role: 'SDR' },
      },
    },
  });

  if (assignments.length === 0) {
    return null;
  }

  // Simple round-robin: get SDR with fewest assigned prospects
  const sdrCounts = await Promise.all(
    assignments.map(async (assignment) => {
      const count = await prisma.prospectProfile.count({
        where: {
          assignedSdrId: assignment.sdrId,
          status: { not: 'REJECTED' },
        },
      });
      return { sdrId: assignment.sdrId, count };
    })
  );

  // Sort by count and pick the one with least prospects
  sdrCounts.sort((a, b) => a.count - b.count);
  return sdrCounts[0]?.sdrId || null;
}
