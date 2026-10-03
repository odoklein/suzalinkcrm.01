// ============================================
// API: /api/comms/groups/[id]/members
// Manage group members
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addGroupMembers, removeGroupMember } from "@/lib/comms/service";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/comms/groups/[id]/members - Add members to group
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.memberIds || body.memberIds.length === 0) {
            return NextResponse.json(
                { error: "memberIds est requis" },
                { status: 400 }
            );
        }

        await addGroupMembers(id, body.memberIds, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error adding group members:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de l'ajout" },
            { status: 500 }
        );
    }
}

// DELETE /api/comms/groups/[id]/members - Remove member from group
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.memberId) {
            return NextResponse.json(
                { error: "memberId est requis" },
                { status: 400 }
            );
        }

        await removeGroupMember(id, body.memberId, session.user.id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error removing group member:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la suppression" },
            { status: 500 }
        );
    }
}
