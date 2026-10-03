// ============================================
// GET /api/session-tasks
// Aggregates all session tasks across clients with role filtering
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

export const GET = withErrorHandler(async (request: NextRequest) => {
    await requireRole(
        ['MANAGER', 'BUSINESS_DEVELOPER', 'SDR', 'BOOKER'],
        request,
    );

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role'); // SDR | MANAGER | DEV | ALWAYS | null (all)
    const status = searchParams.get('status'); // pending | done | all
    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search');

    // Build where clause
    const whereClause: any = {};

    if (role && role !== 'ALL') {
        whereClause.assigneeRole = role;
    }

    if (status === 'pending') {
        whereClause.doneAt = null;
    } else if (status === 'done') {
        whereClause.doneAt = { not: null };
    }

    if (clientId) {
        whereClause.session = { clientId };
    }

    if (search) {
        whereClause.label = { contains: search, mode: 'insensitive' };
    }

    const tasks = await prisma.sessionTask.findMany({
        where: whereClause,
        include: {
            session: {
                select: {
                    id: true,
                    type: true,
                    date: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: [
            { doneAt: 'asc' }, // pending first
            { createdAt: 'desc' },
        ],
    });

    const formatted = tasks.map((t) => ({
        id: t.id,
        label: t.label,
        assignee: t.assignee,
        assigneeRole: t.assigneeRole,
        priority: t.priority,
        doneAt: t.doneAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        sessionId: t.sessionId,
        sessionType: t.session.type,
        sessionDate: t.session.date.toISOString(),
        clientId: t.session.client.id,
        clientName: t.session.client.name,
    }));

    // Group by status for Kanban
    const grouped = {
        pending: formatted.filter((t) => !t.doneAt),
        done: formatted.filter((t) => !!t.doneAt),
    };

    // Stats by role
    const byRole = {
        SDR: formatted.filter((t) => t.assigneeRole === 'SDR').length,
        MANAGER: formatted.filter((t) => t.assigneeRole === 'MANAGER').length,
        DEV: formatted.filter((t) => t.assigneeRole === 'DEV').length,
        ALWAYS: formatted.filter((t) => t.assigneeRole === 'ALWAYS').length,
    };

    return successResponse({
        tasks: formatted,
        grouped,
        byRole,
        total: formatted.length,
    });
});

// ============================================
// PATCH /api/session-tasks
// Toggle task completion or update fields
// ============================================

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, doneAt, label, assigneeRole, priority, assignee } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'ID requis' },
                { status: 400 },
            );
        }

        const task = await prisma.sessionTask.findUnique({ where: { id } });
        if (!task) {
            return NextResponse.json(
                { success: false, error: 'Tâche introuvable' },
                { status: 404 },
            );
        }

        const updateData: any = {};

        if (doneAt !== undefined) {
            // Toggle done
            updateData.doneAt =
                doneAt === null
                    ? null
                    : doneAt === 'toggle'
                      ? task.doneAt
                          ? null
                          : new Date()
                      : new Date(doneAt);
        }

        if (label !== undefined) updateData.label = label;
        if (assigneeRole !== undefined) updateData.assigneeRole = assigneeRole;
        if (priority !== undefined) updateData.priority = priority;
        if (assignee !== undefined) updateData.assignee = assignee;

        const updated = await prisma.sessionTask.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: updated.id,
                label: updated.label,
                assignee: updated.assignee,
                assigneeRole: updated.assigneeRole,
                priority: updated.priority,
                doneAt: updated.doneAt?.toISOString() ?? null,
            },
        });
    } catch (error) {
        console.error('PATCH /api/session-tasks error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 },
        );
    }
}
