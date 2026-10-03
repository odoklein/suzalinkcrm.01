// ============================================
// PROSPECT ACTIVATION SERVICE
// Creates Contact/Company and assigns to Mission
// ============================================

import { prisma } from '@/lib/prisma';
import { ProspectProfile, ProspectStatus } from '@prisma/client';

export interface ActivationResult {
  contactId: string;
  companyId: string;
  listId: string;
  success: boolean;
  error?: string;
}

// ============================================
// ACTIVATE PROSPECT
// ============================================

export async function activateProspect(profileId: string): Promise<ActivationResult> {
  const profile = await prisma.prospectProfile.findUnique({
    where: { id: profileId },
    include: {
      assignedMission: {
        include: {
          lists: true,
        },
      },
    },
  });

  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  if (!profile.assignedMissionId || !profile.assignedMission) {
    throw new Error('Prospect must be assigned to a mission before activation');
  }

  if (profile.status === ProspectStatus.ACTIVATED) {
    throw new Error('Prospect already activated');
  }

  const mission = profile.assignedMission;

  // Get or create a list for this mission
  let list = mission.lists[0];
  if (!list) {
    // Create a default list
    list = await prisma.list.create({
      data: {
        missionId: mission.id,
        name: `Prospects - ${new Date().toLocaleDateString()}`,
        type: 'CLIENT',
        source: 'POE',
      },
    });
  }

  // Create or find company
  let company = null;
  if (profile.companyName) {
    company = await prisma.company.findFirst({
      where: {
        listId: list.id,
        name: profile.companyName,
      },
    });

    if (!company) {
      company = await prisma.company.create({
        data: {
          listId: list.id,
          name: profile.companyName,
          industry: profile.companyIndustry || null,
          country: profile.companyCountry || null,
          website: profile.companyWebsite || null,
          size: profile.companySize || null,
          status: 'ACTIONABLE',
        },
      });
    }
  } else {
    // Create a placeholder company if no company name
    company = await prisma.company.create({
      data: {
        listId: list.id,
        name: 'Unknown Company',
        status: 'INCOMPLETE',
      },
    });
  }

  // Create contact
  const contact = await prisma.contact.create({
    data: {
      companyId: company.id,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      email: profile.email || null,
      phone: profile.phone || null,
      linkedin: profile.linkedin || null,
      title: profile.title || null,
      status: 'ACTIONABLE',
    },
  });

  // Update prospect profile
  await prisma.prospectProfile.update({
    where: { id: profileId },
    data: {
      status: ProspectStatus.ACTIVATED,
      activatedAt: new Date(),
      activatedContactId: contact.id,
      activatedCompanyId: company.id,
    },
  });

  return {
    contactId: contact.id,
    companyId: company.id,
    listId: list.id,
    success: true,
  };
}
