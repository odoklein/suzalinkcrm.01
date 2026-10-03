// ============================================
// MESSAGE SUGGESTIONS API
// Get AI-generated reply suggestions
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateMessageSuggestions } from "@/lib/comms/ai";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id: threadId } = await params;

        const suggestions = await generateMessageSuggestions(threadId, session.user.id);
        return NextResponse.json(suggestions);
    } catch (error) {
        console.error("Suggestions error:", error);
        return NextResponse.json(
            { error: "Failed to generate suggestions" },
            { status: 500 }
        );
    }
}
