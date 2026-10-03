import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, successResponse, errorResponse, withErrorHandler } from '@/lib/api-utils';
import { z } from 'zod';

// Schema for params
const paramsSchema = z.object({
  id: z.string(),
});

// DELETE /api/manager/api-keys/:id - Revoke an API key
export const DELETE = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole(['MANAGER'], request);

  const { id } = paramsSchema.parse(params);

  const apiKey = await prisma.apiKey.findUnique({
    where: { id },
  });

  if (!apiKey) {
    return errorResponse('API key not found', 404);
  }

  // Soft delete by deactivating
  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return successResponse({ message: 'API key revoked successfully' });
});

// PATCH /api/manager/api-keys/:id - Update API key (reactivate or modify)
export const PATCH = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole(['MANAGER'], request);

  const { id } = paramsSchema.parse(params);
  const body = await request.json();

  const apiKey = await prisma.apiKey.findUnique({
    where: { id },
  });

  if (!apiKey) {
    return errorResponse('API key not found', 404);
  }

  // Only allow updating certain fields
  const allowedUpdates: Record<string, unknown> = {};
  if (body.name !== undefined) allowedUpdates.name = body.name;
  if (body.isActive !== undefined) allowedUpdates.isActive = body.isActive;
  if (body.rateLimitPerMinute !== undefined) allowedUpdates.rateLimitPerMinute = body.rateLimitPerMinute;
  if (body.rateLimitPerHour !== undefined) allowedUpdates.rateLimitPerHour = body.rateLimitPerHour;
  if (body.allowedEndpoints !== undefined) allowedUpdates.allowedEndpoints = body.allowedEndpoints;

  const updated = await prisma.apiKey.update({
    where: { id },
    data: allowedUpdates,
    include: {
      client: { select: { id: true, name: true } },
      mission: { select: { id: true, name: true } },
      _count: {
        select: { usageLogs: true },
      },
    },
  });

  return successResponse({
    id: updated.id,
    name: updated.name,
    keyPrefix: updated.keyPrefix,
    role: updated.role,
    client: updated.client,
    mission: updated.mission,
    allowedEndpoints: updated.allowedEndpoints,
    rateLimitPerMinute: updated.rateLimitPerMinute,
    rateLimitPerHour: updated.rateLimitPerHour,
    isActive: updated.isActive,
    lastUsedAt: updated.lastUsedAt,
    expiresAt: updated.expiresAt,
    usageCount: updated._count.usageLogs,
  });
});

// GET /api/manager/api-keys/:id - Get API key details with usage stats
export const GET = withErrorHandler(async (request: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole(['MANAGER'], request);

  const { id } = paramsSchema.parse(params);

  const apiKey = await prisma.apiKey.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      mission: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: {
        select: { usageLogs: true },
      },
      usageLogs: {
        orderBy: { createdAt: 'desc' },
        take: 100, // Last 100 requests
        select: {
          id: true,
          endpoint: true,
          method: true,
          statusCode: true,
          responseTimeMs: true,
          ipAddress: true,
          createdAt: true,
        },
      },
    },
  });

  if (!apiKey) {
    return errorResponse('API key not found', 404);
  }

  // Get usage stats by endpoint
  const usageByEndpoint = await prisma.apiKeyUsageLog.groupBy({
    by: ['endpoint'],
    where: { apiKeyId: id },
    _count: true,
  });

  // Get usage stats by day (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyUsage = await prisma.apiKeyUsageLog.groupBy({
    by: ['createdAt'],
    where: {
      apiKeyId: id,
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: true,
  });

  return successResponse({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    role: apiKey.role,
    client: apiKey.client,
    mission: apiKey.mission,
    allowedEndpoints: apiKey.allowedEndpoints,
    rateLimitPerMinute: apiKey.rateLimitPerMinute,
    rateLimitPerHour: apiKey.rateLimitPerHour,
    isActive: apiKey.isActive,
    lastUsedAt: apiKey.lastUsedAt,
    expiresAt: apiKey.expiresAt,
    createdBy: apiKey.createdBy,
    createdAt: apiKey.createdAt,
    updatedAt: apiKey.updatedAt,
    usageCount: apiKey._count.usageLogs,
    recentUsage: apiKey.usageLogs,
    usageByEndpoint,
    dailyUsage,
  });
});
