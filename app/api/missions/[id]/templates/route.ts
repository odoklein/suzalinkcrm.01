import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET /api/missions/[id]/templates - List templates for a mission
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;

        const missionTemplates = await prisma.missionEmailTemplate.findMany({
            where: { missionId: id },
            include: {
                template: {
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { order: 'asc' }
        });

        return NextResponse.json({
            success: true,
            data: missionTemplates.map(mt => ({
                id: mt.id,
                // Expose underlying templateId so SDR email flows can reference it directly
                templateId: mt.templateId,
                order: mt.order,
                createdAt: mt.createdAt,
                template: mt.template,
            })),
        });
    } catch (error) {
        console.error('GET /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// POST /api/missions/[id]/templates - Add or create+link template to mission
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { templateId, order, createNew, name, subject, bodyHtml, bodyText, category, variables } = body;

        // Check if mission exists
        const mission = await prisma.mission.findUnique({ where: { id } });
        if (!mission) {
            return NextResponse.json(
                { success: false, error: 'Mission non trouvée' },
                { status: 404 }
            );
        }

        // Get max order for placement
        const maxOrder = await prisma.missionEmailTemplate.findFirst({
            where: { missionId: id },
            orderBy: { order: 'desc' },
            select: { order: true }
        });
        const nextOrder = order ?? (maxOrder?.order ?? 0) + 1;

        let resolvedTemplateId = templateId;

        // Create a new template and link it in one call
        if (createNew) {
            if (!name || !subject || !bodyHtml) {
                return NextResponse.json(
                    { success: false, error: 'name, subject et bodyHtml requis pour créer un template' },
                    { status: 400 }
                );
            }
            const newTemplate = await prisma.emailTemplate.create({
                data: {
                    name,
                    subject,
                    bodyHtml,
                    bodyText: bodyText || '',
                    category: category || 'OUTREACH',
                    isShared: true,
                    variables: variables || [],
                    createdById: session.user.id,
                }
            });
            resolvedTemplateId = newTemplate.id;
        }

        if (!resolvedTemplateId) {
            return NextResponse.json(
                { success: false, error: 'templateId requis' },
                { status: 400 }
            );
        }

        // Check if template exists
        const template = await prisma.emailTemplate.findUnique({ where: { id: resolvedTemplateId } });
        if (!template) {
            return NextResponse.json(
                { success: false, error: 'Template non trouvé' },
                { status: 404 }
            );
        }

        // Check if already assigned
        const existing = await prisma.missionEmailTemplate.findUnique({
            where: { missionId_templateId: { missionId: id, templateId: resolvedTemplateId } }
        });
        if (existing) {
            return NextResponse.json(
                { success: false, error: 'Template déjà assigné à cette mission' },
                { status: 400 }
            );
        }

        const missionTemplate = await prisma.missionEmailTemplate.create({
            data: {
                missionId: id,
                templateId: resolvedTemplateId,
                order: nextOrder
            },
            include: {
                template: {
                    include: {
                        createdBy: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                id: missionTemplate.id,
                order: missionTemplate.order,
                createdAt: missionTemplate.createdAt,
                template: missionTemplate.template
            }
        }, { status: 201 });
    } catch (error) {
        console.error('POST /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// PATCH /api/missions/[id]/templates - Bulk reorder or update a template
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const { action, orders, templateId, name, subject, bodyHtml, bodyText, category, variables, duplicate } = body;

        // Bulk reorder: [{ missionTemplateId, order }]
        if (action === 'reorder' && Array.isArray(orders)) {
            await Promise.all(
                orders.map(({ missionTemplateId, order }: { missionTemplateId: string; order: number }) =>
                    prisma.missionEmailTemplate.update({
                        where: { id: missionTemplateId },
                        data: { order }
                    })
                )
            );
            return NextResponse.json({ success: true });
        }

        // Update an underlying email template content
        if (action === 'update' && templateId) {
            const updated = await prisma.emailTemplate.update({
                where: { id: templateId },
                data: {
                    ...(name !== undefined && { name }),
                    ...(subject !== undefined && { subject }),
                    ...(bodyHtml !== undefined && { bodyHtml }),
                    ...(bodyText !== undefined && { bodyText }),
                    ...(category !== undefined && { category }),
                    ...(variables !== undefined && { variables }),
                },
                include: {
                    createdBy: { select: { id: true, name: true, email: true } }
                }
            });
            return NextResponse.json({ success: true, data: updated });
        }

        // Duplicate a template and link it to the mission
        if (action === 'duplicate' && templateId) {
            const source = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
            if (!source) {
                return NextResponse.json({ success: false, error: 'Template source non trouvé' }, { status: 404 });
            }

            const maxOrder = await prisma.missionEmailTemplate.findFirst({
                where: { missionId: id },
                orderBy: { order: 'desc' },
                select: { order: true }
            });

            const copy = await prisma.emailTemplate.create({
                data: {
                    name: `${source.name} (copie)`,
                    subject: source.subject,
                    bodyHtml: source.bodyHtml,
                    bodyText: source.bodyText,
                    category: source.category,
                    isShared: source.isShared,
                    variables: source.variables,
                    createdById: session.user.id,
                }
            });

            const missionTemplate = await prisma.missionEmailTemplate.create({
                data: {
                    missionId: id,
                    templateId: copy.id,
                    order: (maxOrder?.order ?? 0) + 1
                },
                include: {
                    template: {
                        include: {
                            createdBy: { select: { id: true, name: true, email: true } }
                        }
                    }
                }
            });

            return NextResponse.json({
                success: true,
                data: {
                    id: missionTemplate.id,
                    order: missionTemplate.order,
                    createdAt: missionTemplate.createdAt,
                    template: missionTemplate.template
                }
            }, { status: 201 });
        }

        return NextResponse.json({ success: false, error: 'Action invalide' }, { status: 400 });
    } catch (error) {
        console.error('PATCH /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// DELETE /api/missions/[id]/templates?templateId=xxx - Remove template from mission
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const templateId = searchParams.get('templateId');

        if (!templateId) {
            return NextResponse.json(
                { success: false, error: 'templateId requis' },
                { status: 400 }
            );
        }

        const deleted = await prisma.missionEmailTemplate.deleteMany({
            where: {
                missionId: id,
                templateId
            }
        });

        if (deleted.count === 0) {
            return NextResponse.json(
                { success: false, error: 'Assignation non trouvée' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/missions/[id]/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
