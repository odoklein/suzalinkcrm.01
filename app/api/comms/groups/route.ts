// ============================================
// API: /api/comms/groups
// List and create communication groups
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserGroups, createGroup } from "@/lib/comms/service";
import type { CreateGroupRequest } from "@/lib/comms/types";

// GET /api/comms/groups - List user's groups
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");

        const groups = await getUserGroups(session.user.id);

        // Filter by search if provided
        let filteredGroups = groups;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredGroups = groups.filter(
                (g) =>
                    g.name.toLowerCase().includes(searchLower) ||
                    g.description?.toLowerCase().includes(searchLower)
            );
        }

        return NextResponse.json({ groups: filteredGroups });
    } catch (error) {
        console.error("Error fetching groups:", error);
        return NextResponse.json(
            { error: "Erreur lors de la récupération des groupes" },
            { status: 500 }
        );
    }
}

// POST /api/comms/groups - Create a new group
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
        }

        // Only Managers and BDs can create groups
        if (!["MANAGER", "BUSINESS_DEVELOPER"].includes(session.user.role)) {
            return NextResponse.json(
                { error: "Vous n'êtes pas autorisé à créer des groupes" },
                { status: 403 }
            );
        }

        const body: CreateGroupRequest = await request.json();

        if (!body.name || body.name.trim().length === 0) {
            return NextResponse.json(
                { error: "Le nom du groupe est requis" },
                { status: 400 }
            );
        }

        if (!body.memberIds || body.memberIds.length === 0) {
            return NextResponse.json(
                { error: "Au moins un membre est requis" },
                { status: 400 }
            );
        }

        const groupId = await createGroup(
            {
                name: body.name.trim(),
                description: body.description?.trim(),
                memberIds: body.memberIds,
            },
            session.user.id
        );

        return NextResponse.json({ id: groupId }, { status: 201 });
    } catch (error) {
        console.error("Error creating group:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erreur lors de la création" },
            { status: 500 }
        );
    }
}
