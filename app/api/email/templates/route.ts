// ============================================
// EMAIL TEMPLATES API ROUTES
// GET /api/email/templates - List templates
// POST /api/email/templates - Create template
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ============================================
// GET - List templates
// ============================================

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const search = searchParams.get('search');

        const whereClause: any = {
            OR: [
                { createdById: session.user.id },
                { isShared: true },
            ],
        };

        if (category) {
            whereClause.category = category;
        }

        if (search) {
            whereClause.AND = [
                {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { subject: { contains: search, mode: 'insensitive' } },
                    ],
                },
            ];
        }

        const templates = await prisma.emailTemplate.findMany({
            where: whereClause,
            orderBy: { updatedAt: 'desc' },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        console.error('GET /api/email/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}

// ============================================
// POST - Create template
// ============================================

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: 'Non autorisé' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { name, subject, bodyHtml, bodyText, category, isShared, variables } = body;

        if (!name?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Le nom est requis' },
                { status: 400 }
            );
        }

        if (!subject?.trim()) {
            return NextResponse.json(
                { success: false, error: 'Le sujet est requis' },
                { status: 400 }
            );
        }

        const template = await prisma.emailTemplate.create({
            data: {
                name: name.trim(),
                subject: subject.trim(),
                bodyHtml: bodyHtml || '',
                bodyText: bodyText || '',
                category: category || 'general',
                isShared: isShared || false,
                variables: variables || [],
                createdById: session.user.id,
            },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: template,
        });
    } catch (error) {
        console.error('POST /api/email/templates error:', error);
        return NextResponse.json(
            { success: false, error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}
