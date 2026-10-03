// ============================================
// SINGLE SEQUENCE API ROUTES
// GET /api/email/sequences/[id] - Get sequence
// PATCH /api/email/sequences/[id] - Update sequence
// DELETE /api/email/sequences/[id] - Delete sequence
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SequenceStatus } from '@prisma/client';

// ============================================
// GET - Get sequence with full details
// ============================================

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { id } = await params;

        const sequence = await prisma.emailSequence.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
                mailbox: {
                    select: {
                        id: true,
                        email: true,
                        displayName: true,
                    },
                },
                campaign: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                enrollments: {
                    select: {
                        id: true,
                        status: true,
                        currentStep: true,
                        contact: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                            },
                        },
                        createdAt: true,
                        completedAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
            },
        });

        if (!sequence) {
            return NextResponse.json(
                { success: false, error: 'Séquence non trouvée' },
                { status: 404 }
            );
        }

        // Check access
        if (sequence.createdById !== session.user.id && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            data: sequence,
        });
    } catch (error) {
        console.error('GET /api/email/sequences/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// PATCH - Update sequence
// ============================================

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await req.json();

        // Get sequence
        const sequence = await prisma.emailSequence.findUnique({
            where: { id },
            select: { createdById: true, status: true },
        });

        if (!sequence) {
            return NextResponse.json(
                { success: false, error: 'Séquence non trouvée' },
                { status: 404 }
            );
        }

        if (sequence.createdById !== session.user.id && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Build update data
        const updateData: Record<string, unknown> = {};

        if (body.name !== undefined) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.status !== undefined && ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'].includes(body.status)) {
            updateData.status = body.status as SequenceStatus;
        }
        if (typeof body.stopOnReply === 'boolean') updateData.stopOnReply = body.stopOnReply;
        if (typeof body.stopOnBounce === 'boolean') updateData.stopOnBounce = body.stopOnBounce;
        if (typeof body.sendOnWeekends === 'boolean') updateData.sendOnWeekends = body.sendOnWeekends;
        if (body.sendTimeStart !== undefined) updateData.sendTimeStart = body.sendTimeStart || null;
        if (body.sendTimeEnd !== undefined) updateData.sendTimeEnd = body.sendTimeEnd || null;

        // Update sequence
        const updated = await prisma.emailSequence.update({
            where: { id },
            data: updateData,
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('PATCH /api/email/sequences/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE - Delete sequence
// ============================================

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Get sequence
        const sequence = await prisma.emailSequence.findUnique({
            where: { id },
            select: { createdById: true, status: true },
        });

        if (!sequence) {
            return NextResponse.json(
                { success: false, error: 'Séquence non trouvée' },
                { status: 404 }
            );
        }

        if (sequence.createdById !== session.user.id && session.user.role !== 'MANAGER') {
            return NextResponse.json(
                { success: false, error: 'Accès non autorisé' },
                { status: 403 }
            );
        }

        // Can't delete active sequence with active enrollments
        if (sequence.status === 'ACTIVE') {
            const activeEnrollments = await prisma.emailSequenceEnrollment.count({
                where: {
                    sequenceId: id,
                    status: 'ACTIVE',
                },
            });

            if (activeEnrollments > 0) {
                return NextResponse.json(
                    { success: false, error: 'Séquence active avec des contacts inscrits' },
                    { status: 400 }
                );
            }
        }

        // Delete sequence (cascades to steps and enrollments)
        await prisma.emailSequence.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Séquence supprimée',
        });
    } catch (error) {
        console.error('DELETE /api/email/sequences/[id] error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
