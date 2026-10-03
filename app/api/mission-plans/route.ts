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

const createPlanSchema = z.object({
    missionId: z.string().min(1, 'Mission requise'),
    frequency: z.number().int().min(1).max(5),
    preferredDays: z.array(dayOfWeekSchema).min(1).max(5),
    timePreference: timePreferenceSchema,
    customStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    customEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    startDate: z.string().min(1, 'Date de début requise'),
    endDate: z.string().optional().nullable(),
    assignedSdrIds: z.array(z.string()).min(1, 'Au moins un SDR requis'),
}).refine(
    (data) => {
        if (data.timePreference !== 'CUSTOM') return true;
        if (!data.customStartTime || !data.customEndTime) return false;
        return data.customStartTime < data.customEndTime;
    },
    { message: 'L\'heure de début doit être avant l\'heure de fin', path: ['customEndTime'] }
);

// GET /api/mission-plans?missionId=...
export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
        return errorResponse('missionId requis', 400);
    }

    const plan = await prisma.missionPlan.findFirst({
        where: { missionId },
        include: {
            mission: { select: { id: true, name: true, channel: true } },
            assignedSdrs: {
                include: { sdr: { select: { id: true, name: true, email: true } } },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    return successResponse(plan);
});

// POST /api/mission-plans
export const POST = withErrorHandler(async (request: NextRequest) => {
    await requireRole(['MANAGER'], request);
    const data = await validateRequest(request, createPlanSchema);

    // Validate preferredDays length matches frequency
    if (data.preferredDays.length !== data.frequency) {
        return errorResponse('Le nombre de jours sélectionnés doit correspondre à la fréquence', 400);
    }

    const mission = await prisma.mission.findUnique({
        where: { id: data.missionId },
        include: { sdrAssignments: { select: { sdrId: true } } },
    });
    if (!mission) {
        throw new NotFoundError('Mission introuvable');
    }

    const assignedSdrIds = new Set(mission.sdrAssignments.map((a) => a.sdrId));
    const invalid = data.assignedSdrIds.filter((id) => !assignedSdrIds.has(id));
    if (invalid.length > 0) {
        return errorResponse('Certains SDRs ne sont pas assignés à cette mission', 400);
    }

    const startDate = new Date(data.startDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (isNaN(startDate.getTime())) {
        return errorResponse('Date de début invalide', 400);
    }
    const dayOfWeek = startDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return errorResponse('La date de début doit être un jour de la semaine (lun-ven)', 400);
    }

    const plan = await prisma.missionPlan.create({
        data: {
            missionId: data.missionId,
            frequency: data.frequency,
            preferredDays: data.preferredDays as ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY')[],
            timePreference: data.timePreference as 'MORNING' | 'AFTERNOON' | 'FULL_DAY' | 'CUSTOM',
            customStartTime: data.timePreference === 'CUSTOM' ? data.customStartTime ?? null : null,
            customEndTime: data.timePreference === 'CUSTOM' ? data.customEndTime ?? null : null,
            startDate,
            endDate,
            status: 'DRAFT',
            assignedSdrs: {
                create: data.assignedSdrIds.map((sdrId) => ({ sdrId })),
            },
        },
        include: {
            mission: { select: { id: true, name: true } },
            assignedSdrs: {
                include: { sdr: { select: { id: true, name: true, email: true } } },
            },
        },
    });

    return successResponse(plan, 201);
});
