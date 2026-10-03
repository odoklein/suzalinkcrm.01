// ============================================
// API: /api/comms/groups/[id]
// Get and update individual groups
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/comms/groups/[id] - Get group details
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        // Verify user is member
        const membership = await prisma.commsGroupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: session.user.id } },
        });

        if (!membership) {
            return NextResponse.json(
                { error: "Groupe non trouvé" },
                { status: 404 }
            );
        }

        const group = await prisma.commsGroup.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, name: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, role: true } },
                    },
                },
                _count: { select: { members: true } },
            },
        });

        if (!group) {
            return NextResponse.json(
                { error: "Groupe non trouvé" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            id: group.id,
            name: group.name,
            description: group.description,
            memberCount: group._count.members,
            members: group.members.map((m) => ({
                id: m.id,
                userId: m.user.id,
                userName: m.user.name,
                userRole: m.user.role,
                role: m.role,
            })),
            createdBy: group.createdBy,
            createdAt: group.createdAt.toISOString(),
        });
    } catch (error) {
        console.error("Error fetching group:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération du groupe" },
            { status: 500 }
        );
    }
}

// PATCH /api/comms/groups/[id] - Update group details
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        // Verify user is admin
        const membership = await prisma.commsGroupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: session.user.id } },
        });

        if (!membership || membership.role !== "admin") {
            return NextResponse.json(
                { error: "Seuls les administrateurs peuvent modifier le groupe" },
                { status: 403 }
            );
        }

        const body = await request.json();

        const updateData: { name?: string; description?: string } = {};
        if (body.name) updateData.name = body.name.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;

        await prisma.commsGroup.update({
            where: { id },
            data: updateData,
        });

        // Also update channel name if group name changed
        if (body.name) {
            await prisma.commsChannel.updateMany({
                where: { groupId: id },
                data: { name: body.name.trim() },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating group:", error);
        return NextResponse.json(
            { error: "Erreur lors de la mise à jour du groupe" },
            { status: 500 }
        );
    }
}

// DELETE /api/comms/groups/[id] - Deactivate group
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;

        // Verify user is admin or manager
        const membership = await prisma.commsGroupMember.findUnique({
            where: { groupId_userId: { groupId: id, userId: session.user.id } },
        });

        const isAdmin = membership?.role === "admin";
        const isManager = session.user.role === "MANAGER";

        if (!isAdmin && !isManager) {
            return NextResponse.json(
                { error: "Seuls les administrateurs peuvent supprimer le groupe" },
                { status: 403 }
            );
        }

        // Soft delete by deactivating
        await prisma.commsGroup.update({
            where: { id },
            data: { isActive: false },
        });

        await prisma.commsChannel.updateMany({
            where: { groupId: id },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting group:", error);
        return NextResponse.json(
            { error: "Erreur lors de la suppression du groupe" },
            { status: 500 }
        );
    }
}
