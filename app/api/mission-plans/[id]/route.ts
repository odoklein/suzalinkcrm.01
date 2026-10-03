import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
    validateRequest,
    NotFoundError,
} from '@/lib/api-utils';
import { z } from 'zod';

const dayOfWeekSchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
const timePreferenceSchema = z.enum(['MORNING', 'AFTERNOON', 'FULL_DAY', 'CUSTOM']);

const updatePlanSchema = z.object({
    frequency: z.number().int().min(1).max(5).optional(),
    preferredDays: z.array(dayOfWeekSchema).min(1).max(5).optional(),
    timePreference: timePreferenceSchema.optional(),
    customStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    customEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    startDate: z.string().optional(),
    endDate: z.string().optional().nullable(),
    assignedSdrIds: z.array(z.string()).min(0).optional(),
}).refine(
    (data) => {
        if (data.timePreference !== 'CUSTOM' && data.timePreference !== undefined) return true;
        if (!data.customStartTime || !data.customEndTime) return true;
        return data.customStartTime < data.customEndTime;
    },
    { message: 'L\'heure de début doit être avant l\'heure de fin', path: ['customEndTime'] }
);

interface RouteParams {
    params: Promise<{ id: string }>;
}

export const GET = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    const plan = await prisma.missionPlan.findUnique({
        where: { id },
        include: {
            mission: { select: { id: true, name: true, channel: true } },
            assignedSdrs: {
                include: { sdr: { select: { id: true, name: true, email: true } } },
            },
        },
    });

    if (!plan) {
        throw new NotFoundError('Plan introuvable');
    }

    return successResponse(plan);
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: RouteParams) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;
    const data = await validateRequest(request, updatePlanSchema);

    const existing = await prisma.missionPlan.findUnique({
        where: { id },
        include: {
            mission: { include: { sdrAssignments: { select: { sdrId: true } } } },
        },
    });

    if (!existing) {
        throw new NotFoundError('Plan introuvable');
    }

    if (data.preferredDays !== undefined && data.frequency !== undefined && data.preferredDays.length !== data.frequency) {
        return errorResponse('Le nombre de jours sélectionnés doit correspondre à la fréquence', 400);
    }

    if (data.assignedSdrIds !== undefined) {
        if (data.assignedSdrIds.length === 0) {
            return errorResponse('Au moins un SDR est requis', 400);
        }
        const assignedSet = new Set(existing.mission.sdrAssignments.map((a) => a.sdrId));
        const invalid = data.assignedSdrIds.filter((sdrId) => !assignedSet.has(sdrId));
        if (invalid.length > 0) {
            return errorResponse('Certains SDRs ne sont pas assignés à cette mission', 400);
        }
    }

    if (data.startDate) {
        const startDate = new Date(data.startDate);
        const dayOfWeek = startDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return errorResponse('La date de début doit être un jour de la semaine (lun-ven)', 400);
        }
    }

    const updateData: Parameters<typeof prisma.missionPlan.update>[0]['data'] = {};
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.preferredDays !== undefined) updateData.preferredDays = data.preferredDays as ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY')[];
    if (data.timePreference !== undefined) updateData.timePreference = data.timePreference as 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'CUSTOM';
    if (data.timePreference !== undefined) {
        updateData.customStartTime = data.timePreference === 'CUSTOM' ? (data.customStartTime ?? null) : null;
        updateData.customEndTime = data.timePreference === 'CUSTOM' ? (data.customEndTime ?? null) : null;
    } else if (data.customStartTime !== undefined) updateData.customStartTime = data.customStartTime;
    else if (data.customEndTime !== undefined) updateData.customEndTime = data.customEndTime;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;

    if (data.assignedSdrIds !== undefined) {
        await prisma.missionPlanSdr.deleteMany({ where: { missionPlanId: id } });
        updateData.assignedSdrs = {
            create: data.assignedSdrIds.map((sdrId) => ({ sdrId })),
        };
    }

    const plan = await prisma.missionPlan.update({
        where: { id },
        data: updateData,
        include: {
            mission: { select: { id: true, name: true } },
            assignedSdrs: {
                include: { sdr: { select: { id: true, name: true, email: true } } },
            },
        },
    });

    return successResponse(plan);
});
