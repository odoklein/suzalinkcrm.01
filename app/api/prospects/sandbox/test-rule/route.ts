// ============================================
// TEST RULE API (Sandbox)
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, withErrorHandler, validateRequest } from '@/lib/api-utils';
import { z } from 'zod';
import { evaluateRule, applyAction } from '@/lib/prospects/rule-engine';
import { ProspectProfile, ProspectPipelineStep } from '@prisma/client';

// ============================================
// SCHEMAS
// ============================================

const testRuleSchema = z.object({
  condition: z.object({
    field: z.string(),
    operator: z.string(),
    value: z.any().optional(),
  }),
  action: z.object({
    type: z.string(),
    value: z.any().optional(),
    reason: z.string(),
  }),
});

// ============================================
// POST /api/prospects/sandbox/test-rule
// ============================================

export const POST = withErrorHandler(async (request: NextRequest) => {
  await requireRole(['MANAGER'], request);
  const { condition, action } = await validateRequest(request, testRuleSchema);

  // Create a mock rule for testing
  const mockRule = {
    id: 'test',
    name: 'Test Rule',
    description: null,
    clientId: null,
    sourceId: null,
    step: ProspectPipelineStep.VALIDATE,
    priority: 0,
    condition: condition as any,
    action: action as any,
    version: 1,
    isActive: true,
    createdById: 'test',
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create a mock profile for testing
  const mockProfile: ProspectProfile = {
    id: 'test-profile',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+33612345678',
    linkedin: null,
    title: 'CEO',
    companyName: 'Acme Corp',
    companyWebsite: 'https://acme.com',
    companyIndustry: 'SaaS',
    companyCountry: 'France',
    companySize: '51-200',
    customFields: null,
    currentStep: ProspectPipelineStep.VALIDATE,
    status: 'PENDING' as any,
    qualityScore: 50,
    confidenceScore: 70,
    assignedMissionId: null,
    assignedSdrId: null,
    duplicateOfId: null,
    reviewRequired: false,
    reviewReason: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    activatedAt: null,
    activatedContactId: null,
    activatedCompanyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Evaluate rule
  const evaluation = evaluateRule(mockRule as any, mockProfile);

  // Apply action if matched
  let actionResult = null;
  if (evaluation.matched && evaluation.action) {
    actionResult = applyAction(evaluation.action, mockProfile);
  }

  return NextResponse.json({
    success: true,
    data: {
      matched: evaluation.matched,
      evaluation,
      actionResult,
      mockProfile: {
        qualityScore: mockProfile.qualityScore,
        confidenceScore: mockProfile.confidenceScore,
      },
      updatedProfile: actionResult?.updatedProfile || {},
    },
  });
});
