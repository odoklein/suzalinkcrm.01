// ============================================
// THREAD SUMMARIZATION API
// Get AI-generated summary of a thread
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { summarizeThread } from "@/lib/comms/ai";

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

        const summary = await summarizeThread(threadId);
        return NextResponse.json(summary);
    } catch (error) {
        console.error("Thread summarization error:", error);
        return NextResponse.json(
            { error: "Failed to summarize thread" },
            { status: 500 }
        );
    }
}
