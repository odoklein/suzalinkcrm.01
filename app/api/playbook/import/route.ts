// ============================================
// POST /api/playbook/import — Create Client + Onboarding + Missions + Campaigns + Templates (Manager only)
// ============================================

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  requireRole,
  withErrorHandler,
  validateRequest,
  errorResponse,
  successResponse,
} from '@/lib/api-utils';
import type { ParsedPlaybook, PlaybookImportResult } from '@/lib/playbook/types';
import { z } from 'zod';

// Relaxed schema for import (user may have edited preview)
const importBodySchema = z.object({
  client: z
    .object({
      name: z.string().min(1, 'Nom client requis'),
      website: z.string().optional().nullable(),
      sector: z.string().optional().nullable(),
      industry: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
    })
    .nullable(),
  missions: z.array(
    z.object({
      name: z.string(),
      channel: z.enum(['CALL', 'EMAIL', 'LINKEDIN']),
      objective: z.string().optional().nullable(),
    })
  ),
  campaign: z
    .object({
      icp: z.string(),
      postesCibles: z.array(z.string()).optional(),
      secteurs: z.array(z.string()).optional(),
      taille: z.string().optional().nullable(),
      zone: z.string().optional().nullable(),
      pitch: z.string().optional().nullable(),
    })
    .nullable(),
  script: z
    .object({
      sections: z.array(z.object({ title: z.string().optional(), content: z.string() })).optional(),
      objections: z.array(z.string()).optional(),
      fullScript: z.string().optional().nullable(),
      intro: z.string().optional().nullable(),
      discovery: z.string().optional().nullable(),
      objection: z.string().optional().nullable(),
      closing: z.string().optional().nullable(),
    })
    .nullable(),
  emailTemplates: z.array(
    z.object({
      name: z.string(),
      subject: z.string(),
      bodyHtml: z.string(),
      bodyText: z.string().optional().nullable(),
      delayLabel: z.string().optional().nullable(),
      order: z.number().optional(),
    })
  ),
  valueProposition: z.string().optional().nullable(),
  sourceFileName: z.string().optional().nullable(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await requireRole(['MANAGER'], request);
  const data = await validateRequest(request, importBodySchema) as ParsedPlaybook;

  if (!data.client?.name?.trim()) {
    return errorResponse('Le nom du client est requis', 400);
  }

  const clientName = data.client.name.trim();
  const now = new Date();
  const endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Ensure we have at least CALL and EMAIL missions
  const missionSpecs = data.missions?.length
    ? data.missions
    : [
        { name: `Prospection ${clientName} – Appel`, channel: 'CALL' as const, objective: `Mission prospection ${clientName}` },
        { name: `Prospection ${clientName} – Email`, channel: 'EMAIL' as const, objective: `Mission prospection ${clientName}` },
      ];

  // Dedupe by channel so we have at most one CALL and one EMAIL
  const hasCall = missionSpecs.some((m) => m.channel === 'CALL');
  const hasEmail = missionSpecs.some((m) => m.channel === 'EMAIL');
  const missionsToCreate = [...missionSpecs];
  if (!hasCall) {
    missionsToCreate.push({ name: `Prospection ${clientName} – Appel`, channel: 'CALL', objective: `Mission ${clientName}` });
  }
  if (!hasEmail) {
    missionsToCreate.push({ name: `Prospection ${clientName} – Email`, channel: 'EMAIL', objective: `Mission ${clientName}` });
  }

  const icp = data.campaign?.icp?.trim() || 'ICP à définir';
  const pitch = data.campaign?.pitch?.trim() || icp;

  const scriptForCampaign = data.script
    ? {
        intro: data.script.intro ?? data.script.fullScript ?? data.script.sections?.[0]?.content ?? '',
        discovery: data.script.discovery ?? data.script.sections?.[1]?.content ?? '',
        objection: data.script.objection ?? (data.script.objections?.length ? data.script.objections.join('\n\n') : ''),
        closing: data.script.closing ?? data.script.sections?.[2]?.content ?? '',
      }
    : undefined;

  const notesParts: string[] = [];
  if (data.client.description) notesParts.push(data.client.description);
  if (data.valueProposition) notesParts.push(`Proposition de valeur:\n${data.valueProposition}`);
  const onboardingNotes = notesParts.length ? notesParts.join('\n\n') : undefined;

  const onboardingData: Record<string, unknown> = {
    website: data.client.website ?? undefined,
    icp: data.campaign?.icp,
    postesCibles: data.campaign?.postesCibles,
    secteurs: data.campaign?.secteurs,
    taille: data.campaign?.taille,
    zone: data.campaign?.zone,
  };

  const onboardingScripts = scriptForCampaign
    ? (scriptForCampaign as unknown as Prisma.InputJsonValue)
    : data.script?.sections?.length
      ? { sections: data.script.sections }
      : undefined;

  let result: PlaybookImportResult = {
    clientId: '',
    missionIds: [],
    campaignIds: [],
    templateIds: [],
  };

  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: clientName,
        email: data.client?.email || undefined,
        phone: data.client?.phone || undefined,
        industry: data.client?.industry ?? data.client?.sector ?? undefined,
      },
    });
    result.clientId = client.id;

    await tx.clientOnboarding.create({
      data: {
        clientId: client.id,
        status: 'DRAFT',
        onboardingData: onboardingData as Prisma.InputJsonValue,
        scripts: onboardingScripts ?? {},
        notes: onboardingNotes ?? undefined,
        createdById: session.user.id,
      },
    });

    const missionCall = missionsToCreate.find((m) => m.channel === 'CALL');
    const missionEmail = missionsToCreate.find((m) => m.channel === 'EMAIL');

    const createdMissions: { id: string; channel: string }[] = [];
    for (const spec of [missionCall, missionEmail].filter(Boolean)) {
      if (!spec) continue;
      const mission = await tx.mission.create({
        data: {
          clientId: client.id,
          name: spec.name,
          objective: spec.objective || `Mission ${clientName}`,
          channel: spec.channel,
          startDate: now,
          endDate,
          isActive: true,
        },
      });
      createdMissions.push(mission);
      result.missionIds.push(mission.id);
    }

    for (const mission of createdMissions) {
      const campaignName =
        mission.channel === 'CALL'
          ? `Campagne Appel – ${clientName}`
          : `Campagne Email – ${clientName}`;
      const scriptPayload =
        mission.channel === 'CALL' && scriptForCampaign ? JSON.stringify(scriptForCampaign) : null;
      const camp = await tx.campaign.create({
        data: {
          missionId: mission.id,
          name: campaignName,
          icp,
          pitch,
          script: scriptPayload,
          isActive: true,
        },
      });
      result.campaignIds.push(camp.id);
    }

    const emailMission = createdMissions.find((m) => m.channel === 'EMAIL');
    if (emailMission && data.emailTemplates?.length) {
      const sorted = [...data.emailTemplates].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        const template = await tx.emailTemplate.create({
          data: {
            name: t.name,
            subject: t.subject || '(Sans objet)',
            bodyHtml: t.bodyHtml || '',
            bodyText: t.bodyText ?? null,
            category: 'sales',
            createdById: session.user.id,
          },
        });
        result.templateIds.push(template.id);
        await tx.missionEmailTemplate.create({
          data: {
            missionId: emailMission.id,
            templateId: template.id,
            order: i + 1,
          },
        });
      }
    }
  });

  return successResponse(result, 201);
});
