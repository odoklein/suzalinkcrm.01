// ============================================
// GET /api/sdr/emails/sent/[id]
// Get detailed information about a single sent email
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { id } = await params;

        const email = await prisma.email.findFirst({
            where: {
                id,
                sentById: session.user.id,
                direction: "OUTBOUND",
            },
            include: {
                contact: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        jobTitle: true,
                        company: {
                            select: {
                                id: true,
                                name: true,
                                website: true,
                            },
                        },
                    },
                },
                mission: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                template: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                sequenceStep: {
                    select: {
                        id: true,
                        order: true,
                        subject: true,
                        sequence: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                sequenceEnrollment: {
                    select: {
                        id: true,
                        status: true,
                        currentStep: true,
                        enrolledAt: true,
                    },
                },
                attachments: {
                    select: {
                        id: true,
                        filename: true,
                        mimeType: true,
                        size: true,
                    },
                },
                mailbox: {
                    select: {
                        id: true,
                        emailAddress: true,
                        displayName: true,
                    },
                },
            },
        });

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Email non trouvé" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: email,
        });
    } catch (error) {
        console.error("GET /api/sdr/emails/sent/[id] error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}

// ============================================
// DELETE /api/sdr/emails/sent/[id]
// Delete a single sent email
// ============================================

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { success: false, error: "Non autorisé" },
                { status: 401 }
            );
        }

        const { id } = await params;

        // Verify ownership
        const email = await prisma.email.findFirst({
            where: {
                id,
                sentById: session.user.id,
                direction: "OUTBOUND",
            },
            select: { id: true },
        });

        if (!email) {
            return NextResponse.json(
                { success: false, error: "Email non trouvé" },
                { status: 404 }
            );
        }

        await prisma.email.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Email supprimé",
        });
    } catch (error) {
        console.error("DELETE /api/sdr/emails/sent/[id] error:", error);
        return NextResponse.json(
            { success: false, error: "Erreur serveur" },
            { status: 500 }
        );
    }
}
