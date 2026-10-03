// ============================================
// COMMS ANALYTICS SERVICE
// Metrics for communication performance
// ============================================

import { prisma } from "@/lib/prisma";

export interface ThreadAnalytics {
    threadId: string;
    responseTime: number | null; // Minutes
    messageCount: number;
    participantCount: number;
    activityScore: number; // 0-100 based on frequency/recency
    resolutionTime: number | null; // Hours, if resolved
}

/**
 * Get analytics for a specific thread.
 */
export async function getThreadAnalytics(
    threadId: string
): Promise<ThreadAnalytics> {
    const thread = await prisma.commsThread.findUnique({
        where: { id: threadId },
        include: {
            messages: {
                orderBy: { createdAt: "asc" },
                select: { createdAt: true, authorId: true },
            },
            participants: {
                select: { id: true },
            },
        },
    });

    if (!thread) {
        throw new Error("Thread not found");
    }

    // Calculate response time (avg time between messages from different authors)
    let totalResponseTimeMs = 0;
    let responseCount = 0;

    for (let i = 1; i < thread.messages.length; i++) {
        const prev = thread.messages[i - 1];
        const curr = thread.messages[i];

        if (prev.authorId !== curr.authorId) {
            const diff =
                new Date(curr.createdAt).getTime() - new Date(prev.createdAt).getTime();
            // Filter out outliers (> 24h) as they likely aren't "responses" in a chat flow
            if (diff < 24 * 60 * 60 * 1000) {
                totalResponseTimeMs += diff;
                responseCount++;
            }
        }
    }

    const avgResponseTimeMinutes =
        responseCount > 0
            ? Math.round(totalResponseTimeMs / responseCount / 1000 / 60)
            : null;

    // Calculate resolution time
    let resolutionTimeHours: number | null = null;
    if (thread.status === "RESOLVED" || thread.status === "ARCHIVED") {
        const firstMsg = thread.messages[0];
        const lastMsg = thread.messages[thread.messages.length - 1];
        if (firstMsg && lastMsg) {
            const diffMs =
                new Date(thread.updatedAt).getTime() -
                new Date(firstMsg.createdAt).getTime();
            resolutionTimeHours = Math.round(diffMs / 1000 / 60 / 60);
        }
    }

    // Calculate activity score (simple heuristic)
    // Based on message count and recency
    const daysSinceLastMsg =
        thread.lastMessageAt
            ? (Date.now() - new Date(thread.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24)
            : 10;

    // Decay score older it gets. Boost by message count.
    // 0 days old = 1.0 decay factor. 30 days old = 0 decay factor.
    const decay = Math.max(0, 1 - daysSinceLastMsg / 30);
    const volumeScore = Math.min(100, thread.messages.length * 5);
    const activityScore = Math.round(volumeScore * decay);

    return {
        threadId: thread.id,
        responseTime: avgResponseTimeMinutes,
        messageCount: thread.messages.length,
        participantCount: thread.participants.length,
        activityScore,
        resolutionTime: resolutionTimeHours,
    };
}
