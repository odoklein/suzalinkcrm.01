import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  requireRole,
  withErrorHandler,
  validateRequest,
} from '@/lib/api-utils';
import { z } from 'zod';

const updateSessionSchema = z.object({
  type: z.string().min(1).optional(),
  date: z.string().optional(),
  crMarkdown: z.string().optional(),
  summaryEmail: z.string().optional(),
  toggleTaskId: z.string().optional(),
  tasks: z
    .array(
      z.object({
        label: z.string().min(1),
        assignee: z.string().optional(),
        assigneeId: z.string().optional(),
        assigneeRole: z.enum(['SDR', 'MANAGER', 'DEV', 'ALWAYS']).optional().default('ALWAYS'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
        dueDate: z.string().optional(),
      }),
    )
    .optional(),
});

export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; sessionId: string }> },
  ) => {
    const sessionUser = await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { id: clientId, sessionId } = await context.params;
    const body = await validateRequest(request, updateSessionSchema);

    const session = await prisma.clientSession.findFirst({
      where: { id: sessionId, clientId },
      include: { tasks: true },
    });
    if (!session) return errorResponse('Session introuvable', 404);

    // Toggle task done/undone
    if (body.toggleTaskId) {
      const task = await prisma.sessionTask.findFirst({
        where: { id: body.toggleTaskId, sessionId },
      });
      if (!task) return errorResponse('Tâche introuvable', 404);

      const newDoneAt = task.doneAt ? null : new Date();
      await prisma.sessionTask.update({
        where: { id: task.id },
        data: { doneAt: newDoneAt },
      });

      if (task.taskId) {
        await prisma.task.update({
          where: { id: task.taskId },
          data: {
            status: newDoneAt ? 'DONE' : 'TODO',
            completedAt: newDoneAt,
          },
        });
      }

      return successResponse({ taskId: task.id, doneAt: newDoneAt?.toISOString() ?? null });
    }

    // Update session fields
    const updated = await prisma.clientSession.update({
      where: { id: sessionId },
      data: {
        type: body.type ?? session.type,
        date: body.date ? new Date(body.date) : session.date,
        crMarkdown: body.crMarkdown ?? session.crMarkdown,
        summaryEmail: body.summaryEmail ?? session.summaryEmail,
      },
    });

    let projectId: string | null = null;

    // Add new tasks from edit modal
    if (body.tasks && body.tasks.length > 0) {
      const userId = sessionUser.user.id;

      const createdTasks = [];
      for (const t of body.tasks) {
        const st = await prisma.sessionTask.create({
          data: {
            sessionId,
            label: t.label,
            assignee: t.assignee,
            assigneeRole: t.assigneeRole || 'ALWAYS',
            priority: t.priority || 'MEDIUM',
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
          },
        });
        createdTasks.push({ sessionTask: st, bodyTask: t });
      }

      // Auto-create or reuse project for mirroring
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true },
      });

      if (client) {
        let project = await prisma.project.findFirst({
          where: { clientId, name: client.name, status: 'ACTIVE' },
        });

        if (!project) {
          project = await prisma.project.create({
            data: {
              name: client.name,
              description: `Projet créé automatiquement à partir des sessions client.`,
              clientId,
              ownerId: userId,
              members: { create: { userId, role: 'owner' } },
            },
          });
        }

        projectId = project.id;

        for (const { sessionTask, bodyTask } of createdTasks) {
          const task = await prisma.task.create({
            data: {
              projectId: project.id,
              title: sessionTask.label,
              description: `Tâche issue d'une session pour le client ${client.name}.`,
              status: 'TODO',
              priority: (sessionTask.priority || 'MEDIUM') as any,
              dueDate: sessionTask.dueDate,
              assigneeId: bodyTask.assigneeId || null,
              createdById: userId,
            },
          });

          await prisma.sessionTask.update({
            where: { id: sessionTask.id },
            data: { taskId: task.id },
          });
        }
      }
    }

    // Re-fetch with tasks
    const full = await prisma.clientSession.findUnique({
      where: { id: sessionId },
      include: { tasks: { orderBy: { createdAt: 'asc' } } },
    });

    return successResponse({
      id: updated.id,
      type: updated.type,
      date: updated.date.toISOString(),
      crMarkdown: updated.crMarkdown,
      summaryEmail: updated.summaryEmail,
      projectId,
      tasks: full?.tasks.map((t) => ({
        id: t.id,
        label: t.label,
        assignee: t.assignee,
        assigneeRole: t.assigneeRole,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        doneAt: t.doneAt?.toISOString() ?? null,
        taskId: t.taskId ?? null,
      })) ?? [],
    });
  },
);

export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string; sessionId: string }> },
  ) => {
    await requireRole(['MANAGER', 'BUSINESS_DEVELOPER'], request);

    const { id: clientId, sessionId } = await context.params;

    const session = await prisma.clientSession.findFirst({
      where: { id: sessionId, clientId },
    });
    if (!session) return errorResponse('Session introuvable', 404);

    await prisma.clientSession.delete({
      where: { id: sessionId },
    });

    return successResponse({ deleted: true });
  },
);
