// ============================================
// PROSPECT PIPELINE SERVICE
// Orchestrates the prospect processing pipeline
// ============================================

import { prisma } from "@/lib/prisma";
import {
  ProspectProfile,
  ProspectPipelineStep,
  ProspectStatus,
  DecisionOutcome,
} from "@prisma/client";
import { normalizeProfile, NormalizedProfile } from "./normalization-service";
import { evaluateRule, applyAction } from "./rule-engine";
import { calculateScores } from "./scoring-service";
import { ProspectRule } from "@prisma/client";

// ============================================
// PROCESS PROFILE THROUGH PIPELINE
// ============================================

export async function processProfile(profileId: string): Promise<void> {
  const profile = await prisma.prospectProfile.findUnique({
    where: { id: profileId },
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!profile) {
    throw new Error(`Profile ${profileId} not found`);
  }

  // Process each step in order
  let currentStep = profile.currentStep;
  let updatedProfile = { ...profile };

  // NORMALIZE
  if (currentStep === ProspectPipelineStep.INTAKE) {
    updatedProfile = await processNormalizeStep(updatedProfile);
    currentStep = ProspectPipelineStep.NORMALIZE;
  }

  // VALIDATE
  if (currentStep === ProspectPipelineStep.NORMALIZE) {
    const validationResult = await processValidateStep(updatedProfile);
    if (validationResult.reviewRequired) {
      await updateProfileStatus(
        profileId,
        ProspectStatus.IN_REVIEW,
        "Validation review required",
        validationResult.reason,
      );
      return;
    }
    if (validationResult.rejected) {
      await updateProfileStatus(
        profileId,
        ProspectStatus.REJECTED,
        validationResult.reason || "Rejected by validation",
      );
      return;
    }
    updatedProfile = { ...updatedProfile, ...validationResult.updatedProfile };
    currentStep = ProspectPipelineStep.VALIDATE;
  }

  // ENRICH (OPTIONAL - after normalization and validation)
  if (currentStep === ProspectPipelineStep.VALIDATE) {
    const enrichmentResult = await processEnrichStep(updatedProfile);
    if (enrichmentResult.enrichedData) {
      updatedProfile = { ...updatedProfile, ...enrichmentResult.enrichedData };
    }
    currentStep = ProspectPipelineStep.ENRICH;
  }

  // SCORE
  if (currentStep === ProspectPipelineStep.ENRICH) {
    updatedProfile = await processScoreStep(updatedProfile);
    currentStep = ProspectPipelineStep.SCORE;
  }

  // DEDUPLICATE
  if (currentStep === ProspectPipelineStep.SCORE) {
    const dedupeResult = await checkDeduplication(profileId);
    if (dedupeResult.isDuplicate) {
      await updateProfileStatus(
        profileId,
        ProspectStatus.DUPLICATE,
        "Duplicate found",
      );
      return;
    }
    currentStep = ProspectPipelineStep.DEDUPLICATE;
  }

  // ROUTE
  if (currentStep === ProspectPipelineStep.DEDUPLICATE) {
    const { routeProspect } = await import("./routing-service");
    const routingResult = await routeProspect(profileId);
    if (!routingResult.missionId) {
      await updateProfileStatus(
        profileId,
        ProspectStatus.IN_REVIEW,
        "Routing requires manual assignment",
        "No mission assigned",
      );
      return;
    }
    currentStep = ProspectPipelineStep.ROUTE;
  }

  // ACTIVATE
  if (currentStep === ProspectPipelineStep.ROUTE) {
    const config = await getPipelineConfig(
      updatedProfile.assignedMission?.clientId || null,
    );
    const canAutoActivate =
      updatedProfile.qualityScore >= (config?.minQualityScore || 50) &&
      updatedProfile.confidenceScore >= (config?.minConfidenceScore || 70) &&
      !updatedProfile.reviewRequired;

    if (canAutoActivate) {
      const { activateProspect } = await import("./activation-service");
      await activateProspect(profileId);
      currentStep = ProspectPipelineStep.ACTIVATE;
    } else {
      await updateProfileStatus(
        profileId,
        ProspectStatus.IN_REVIEW,
        "Activation requires review",
        "Score below threshold or review required",
      );
      return;
    }
  }

  // Update profile with new step
  await prisma.prospectProfile.update({
    where: { id: profileId },
    data: {
      currentStep,
      ...updatedProfile,
    },
  });
}

// ============================================
// CHECK DEDUPLICATION
// ============================================

async function checkDeduplication(
  profileId: string,
): Promise<{ isDuplicate: boolean }> {
  const profile = await prisma.prospectProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    return { isDuplicate: false };
  }

  // Check for duplicates by email or phone
  if (profile.email) {
    const duplicate = await prisma.prospectProfile.findFirst({
      where: {
        email: profile.email,
        id: { not: profileId },
        status: { not: ProspectStatus.DUPLICATE },
      },
    });

    if (duplicate) {
      return { isDuplicate: true };
    }
  }

  if (profile.phone) {
    const duplicate = await prisma.contact.findFirst({
      where: {
        phone: profile.phone,
      },
    });

    if (duplicate) {
      return { isDuplicate: true };
    }
  }

  return { isDuplicate: false };
}

// ============================================
// NORMALIZE STEP
// ============================================

async function processNormalizeStep(
  profile: ProspectProfile,
): Promise<Partial<ProspectProfile>> {
  // Get latest event with raw payload
  const latestEvent = await prisma.prospectEvent.findFirst({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });

  if (!latestEvent) {
    return {};
  }

  const rawPayload = latestEvent.rawPayload as Record<string, unknown>;
  const normalized = normalizeProfile(rawPayload);

  // Log decision
  await createDecisionLog(
    profile.id,
    ProspectPipelineStep.NORMALIZE,
    DecisionOutcome.PASS,
    {
      reason: "Fields normalized from raw payload",
      inputData: rawPayload,
      outputData: normalized,
    },
  );

  return normalized;
}

// ============================================
// VALIDATE STEP
// ============================================

async function processValidateStep(profile: ProspectProfile): Promise<{
  updatedProfile: Partial<ProspectProfile>;
  reviewRequired: boolean;
  rejected: boolean;
  reason?: string;
}> {
  // Get active rules for VALIDATE step
  const rules = await prisma.prospectRule.findMany({
    where: {
      step: ProspectPipelineStep.VALIDATE,
      isActive: true,
      OR: [
        { clientId: null }, // Global rules
        { clientId: profile.assignedMission?.clientId || undefined },
      ],
    },
    orderBy: { priority: "desc" },
  });

  let updatedProfile: Partial<ProspectProfile> = {};
  let reviewRequired = false;
  let rejected = false;
  let reason: string | undefined;

  // Evaluate each rule
  for (const rule of rules) {
    const evaluation = evaluateRule(rule, profile as ProspectProfile);

    if (evaluation.matched && evaluation.action) {
      const actionResult = applyAction(
        evaluation.action,
        profile as ProspectProfile,
      );

      // Merge updates
      updatedProfile = { ...updatedProfile, ...actionResult.updatedProfile };

      if (actionResult.reviewRequired) {
        reviewRequired = true;
        reason = actionResult.reason;
      }

      if (actionResult.rejected) {
        rejected = true;
        reason = actionResult.reason;
        break; // Stop processing if rejected
      }

      // Log decision
      await createDecisionLog(
        profile.id,
        ProspectPipelineStep.VALIDATE,
        DecisionOutcome.PASS,
        {
          reason: evaluation.reason || "Rule matched",
          ruleId: rule.id,
          ruleResult: evaluation,
        },
      );
    }
  }

  return { updatedProfile, reviewRequired, rejected, reason };
}

// ============================================
// ENRICH STEP (APOLLO.IO)
// ============================================

async function processEnrichStep(profile: ProspectProfile): Promise<{
  enrichedData: Partial<ProspectProfile> | null;
}> {
  // Check if enrichment is enabled for this client
  const config = await getPipelineConfig(
    profile.assignedMissionId
      ? (
          await prisma.mission.findUnique({
            where: { id: profile.assignedMissionId },
            select: { clientId: true },
          })
        )?.clientId || null
      : null,
  );

  if (!config?.enableEnrichment) {
    console.log("[Pipeline] Enrichment disabled for this profile");
    return { enrichedData: null };
  }

  // Only enrich if provider is apollo or not specified (default)
  if (config.enrichmentProvider && config.enrichmentProvider !== "apollo") {
    console.log(
      `[Pipeline] Enrichment provider is ${config.enrichmentProvider}, skipping Apollo`,
    );
    return { enrichedData: null };
  }

  try {
    const { enrichFromApollo } = await import("@/lib/listing/apollo-service");
    const apolloResult = await enrichFromApollo(profile);

    if (!apolloResult) {
      // No enrichment data found - this is not an error
      console.log("[Pipeline] Apollo returned no enrichment data");

      await createDecisionLog(
        profile.id,
        ProspectPipelineStep.ENRICH,
        DecisionOutcome.SKIP,
        {
          reason: "No enrichment data available from Apollo",
          inputData: {
            hasEmail: !!profile.email,
            hasLinkedIn: !!profile.linkedin,
            hasCompany: !!profile.companyName,
          },
        },
      );

      return { enrichedData: null };
    }

    // Apply enrichment results - ONLY FILL MISSING FIELDS
    const enrichedData: Partial<ProspectProfile> = {};
    const fieldsEnriched: string[] = [];

    // Person enrichment (only if missing)
    if (apolloResult.person) {
      if (!profile.firstName && apolloResult.person.firstName) {
        enrichedData.firstName = apolloResult.person.firstName;
        fieldsEnriched.push("firstName");
      }
      if (!profile.lastName && apolloResult.person.lastName) {
        enrichedData.lastName = apolloResult.person.lastName;
        fieldsEnriched.push("lastName");
      }
      if (!profile.title && apolloResult.person.title) {
        enrichedData.title = apolloResult.person.title;
        fieldsEnriched.push("title");
      }
      if (!profile.linkedin && apolloResult.person.linkedin) {
        enrichedData.linkedin = apolloResult.person.linkedin;
        fieldsEnriched.push("linkedin");
      }
      if (!profile.email && apolloResult.person.email) {
        enrichedData.email = apolloResult.person.email;
        fieldsEnriched.push("email");
      }
      if (!profile.phone && apolloResult.person.phone) {
        enrichedData.phone = apolloResult.person.phone;
        fieldsEnriched.push("phone");
      }
    }

    // Company enrichment (only if missing)
    if (apolloResult.company) {
      if (!profile.companyName && apolloResult.company.name) {
        enrichedData.companyName = apolloResult.company.name;
        fieldsEnriched.push("companyName");
      }
      if (!profile.companyWebsite && apolloResult.company.domain) {
        enrichedData.companyWebsite = apolloResult.company.domain;
        fieldsEnriched.push("companyWebsite");
      }
      if (!profile.companyIndustry && apolloResult.company.industry) {
        enrichedData.companyIndustry = apolloResult.company.industry;
        fieldsEnriched.push("companyIndustry");
      }
      if (!profile.companyCountry && apolloResult.company.country) {
        enrichedData.companyCountry = apolloResult.company.country;
        fieldsEnriched.push("companyCountry");
      }
      if (!profile.companySize && apolloResult.company.size) {
        enrichedData.companySize = apolloResult.company.size;
        fieldsEnriched.push("companySize");
      }
    }

    // Store full Apollo response in customFields for reference
    const existingCustomFields = (profile.customFields as any) || {};
    enrichedData.customFields = {
      ...existingCustomFields,
      apolloEnrichment: {
        ...apolloResult,
        enrichedAt: new Date().toISOString(),
        fieldsEnriched,
      },
    };

    // Emit ProspectEvent for enrichment
    await prisma.prospectEvent.create({
      data: {
        sourceId:
          (
            await prisma.prospectEvent.findFirst({
              where: { profileId: profile.id },
              orderBy: { createdAt: "asc" },
            })
          )?.sourceId || "", // Use original source
        profileId: profile.id,
        rawPayload: apolloResult,
        eventType: "enrichment",
        step: ProspectPipelineStep.ENRICH,
        outcome: DecisionOutcome.PASS,
        processedBy: "apollo",
      },
    });

    // Log decision
    await createDecisionLog(
      profile.id,
      ProspectPipelineStep.ENRICH,
      DecisionOutcome.PASS,
      {
        reason: `Enriched ${fieldsEnriched.length} field(s) from Apollo: ${fieldsEnriched.join(", ")}`,
        inputData: {
          provider: "apollo",
          confidence: apolloResult.confidence,
        },
        outputData: {
          fieldsEnriched,
          enrichmentSource: apolloResult.source,
        },
      },
    );

    console.log(
      `[Pipeline] Apollo enrichment applied: ${fieldsEnriched.length} fields`,
    );

    return { enrichedData };
  } catch (error) {
    // Enrichment failure should NEVER break the pipeline
    console.error("[Pipeline] Enrichment step failed (continuing):", {
      message: error instanceof Error ? error.message : "Unknown error",
      // DO NOT log profileId or PII
    });

    await createDecisionLog(
      profile.id,
      ProspectPipelineStep.ENRICH,
      DecisionOutcome.SKIP,
      {
        reason: `Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        inputData: {},
      },
    );

    return { enrichedData: null };
  }
}

// ============================================
// SCORE STEP
// ============================================

async function processScoreStep(
  profile: ProspectProfile,
): Promise<Partial<ProspectProfile>> {
  const scores = calculateScores(profile);

  // Apply scoring rules
  const rules = await prisma.prospectRule.findMany({
    where: {
      step: ProspectPipelineStep.SCORE,
      isActive: true,
      OR: [
        { clientId: null },
        { clientId: profile.assignedMission?.clientId || undefined },
      ],
    },
    orderBy: { priority: "desc" },
  });

  let qualityScore = scores.qualityScore;

  for (const rule of rules) {
    const evaluation = evaluateRule(rule, {
      ...profile,
      qualityScore,
    } as ProspectProfile);

    if (evaluation.matched && evaluation.action) {
      const actionResult = applyAction(evaluation.action, {
        ...profile,
        qualityScore,
      } as ProspectProfile);
      qualityScore = actionResult.updatedProfile.qualityScore || qualityScore;

      await createDecisionLog(
        profile.id,
        ProspectPipelineStep.SCORE,
        DecisionOutcome.PASS,
        {
          reason: evaluation.reason || "Scoring rule applied",
          ruleId: rule.id,
          ruleResult: evaluation,
        },
      );
    }
  }

  // Check if review is required based on score
  const config = await getPipelineConfig(
    profile.assignedMission?.clientId || null,
  );
  const reviewRequired = qualityScore < (config?.reviewThreshold || 40);

  // Log decision
  await createDecisionLog(
    profile.id,
    ProspectPipelineStep.SCORE,
    DecisionOutcome.PASS,
    {
      reason: `Quality: ${qualityScore}, Confidence: ${scores.confidenceScore}`,
      inputData: {
        qualityScore: scores.qualityScore,
        confidenceScore: scores.confidenceScore,
      },
      outputData: { qualityScore, confidenceScore: scores.confidenceScore },
    },
  );

  return {
    qualityScore,
    confidenceScore: scores.confidenceScore,
    reviewRequired,
    reviewReason: reviewRequired
      ? `Quality score ${qualityScore} below threshold`
      : null,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function createDecisionLog(
  profileId: string,
  step: ProspectPipelineStep,
  outcome: DecisionOutcome,
  data: {
    reason: string;
    ruleId?: string;
    ruleResult?: any;
    inputData?: any;
    outputData?: any;
  },
) {
  await prisma.prospectDecisionLog.create({
    data: {
      profileId,
      step,
      outcome,
      ruleId: data.ruleId,
      ruleResult: data.ruleResult || null,
      inputData: data.inputData || {},
      outputData: data.outputData || null,
      reason: data.reason,
      executedBy: "system",
    },
  });
}

async function updateProfileStatus(
  profileId: string,
  status: ProspectStatus,
  reason: string,
  reviewReason?: string,
) {
  await prisma.prospectProfile.update({
    where: { id: profileId },
    data: {
      status,
      reviewRequired: status === ProspectStatus.IN_REVIEW,
      reviewReason: reviewReason || reason,
    },
  });
}

async function getPipelineConfig(clientId: string | null) {
  if (!clientId) {
    return await prisma.prospectPipelineConfig.findFirst({
      where: { clientId: null },
    });
  }
  return await prisma.prospectPipelineConfig.findUnique({
    where: { clientId },
  });
}
