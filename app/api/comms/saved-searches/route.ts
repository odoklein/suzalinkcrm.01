// ============================================
// SAVED SEARCHES API ROUTE
// CRUD for user's saved search queries
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getSavedSearches,
    createSavedSearch,
    deleteSavedSearch,
    type SavedSearchData,
} from "@/lib/comms/search";

// GET - List user's saved searches
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const searches = await getSavedSearches(session.user.id);
        return NextResponse.json(searches);
    } catch (error) {
        console.error("Error fetching saved searches:", error);
        return NextResponse.json(
            { error: "Failed to fetch saved searches" },
            { status: 500 }
        );
    }
}

// POST - Create a saved search
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.query) {
            return NextResponse.json(
                { error: "Name and query are required" },
                { status: 400 }
            );
        }

        const data: SavedSearchData = {
            name: body.name,
            query: body.query,
            filters: body.filters || undefined,
        };

        const search = await createSavedSearch(session.user.id, data);
        return NextResponse.json(search, { status: 201 });
    } catch (error) {
        console.error("Error creating saved search:", error);
        return NextResponse.json(
            { error: "Failed to create saved search" },
            { status: 500 }
        );
    }
}

// DELETE - Delete a saved search by ID (passed in body)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const searchId = searchParams.get("id");

        if (!searchId) {
            return NextResponse.json(
                { error: "Search ID is required" },
                { status: 400 }
            );
        }

        await deleteSavedSearch(session.user.id, searchId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting saved search:", error);
        return NextResponse.json(
            { error: "Failed to delete saved search" },
            { status: 500 }
        );
    }
}
