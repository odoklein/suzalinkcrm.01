// ============================================
// COMMS SEARCH API ROUTE
// Full-text search across messages and threads
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchComms, type CommsSearchFilters } from "@/lib/comms/search";

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        const query = searchParams.get("q") || "";
        const channelType = searchParams.get("type") || undefined;
        const authorId = searchParams.get("author") || undefined;
        const fromDateStr = searchParams.get("from") || undefined;
        const toDateStr = searchParams.get("to") || undefined;
        const threadId = searchParams.get("threadId") || undefined;
        const status = searchParams.get("status") || undefined;
        const page = parseInt(searchParams.get("page") || "1", 10);
        const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

        // Validate minimum query length
        if (!query || query.trim().length < 2) {
            return NextResponse.json(
                { error: "Search query must be at least 2 characters" },
                { status: 400 }
            );
        }

        const filters: CommsSearchFilters = {
            query: query.trim(),
            channelType: channelType as CommsSearchFilters["channelType"],
            authorId,
            threadId,
            status: status as CommsSearchFilters["status"],
        };

        // Parse dates if provided
        if (fromDateStr) {
            const fromDate = new Date(fromDateStr);
            if (!isNaN(fromDate.getTime())) {
                filters.fromDate = fromDate;
            }
        }

        if (toDateStr) {
            const toDate = new Date(toDateStr);
            if (!isNaN(toDate.getTime())) {
                filters.toDate = toDate;
            }
        }

        const results = await searchComms(
            session.user.id,
            filters,
            page,
            Math.min(pageSize, 50) // Cap at 50 results per page
        );

        return NextResponse.json(results);
    } catch (error) {
        console.error("Comms search error:", error);
        return NextResponse.json(
            { error: "Failed to search messages" },
            { status: 500 }
        );
    }
}
