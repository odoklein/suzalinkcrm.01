// ============================================
// COMMS ACTIVITY SERVICE
// Fetch recent activity across the communication system
// ============================================

import { prisma } from "@/lib/prisma";
import type { CommsChannelType } from "./types";

export interface CommsActivityItem {
    id: string;
    type: "new_thread" | "new_message" | "status_change" | "mention" | "reaction";
    timestamp: string;
    actor: {
        id: string;
        name: string;
    };
    details: {
        threadId: string;
        threadSubject: string;
        channelType: CommsChannelType;
        channelName: string;
        contentPreview?: string;
        metadata?: string; // e.g., "resolved", "👍"
    };
    isRead: boolean;
}

/**
 * Get recent activity for a user (dashboard feed).
 */
export async function getCommsActivity(
    userId: string,
    limit = 20
): Promise<CommsActivityItem[]> {
    const activities: CommsActivityItem[] = [];

    // 1. Fetch recent threads where user is a participant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threads = await prisma.commsThread.findMany({
        where: {
            participants: { some: { userId } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: {
            createdBy: { select: { id: true, name: true } },
            channel: {
                include: {
                    mission: { select: { name: true } },
                    client: { select: { name: true } },
                    campaign: { select: { name: true } },
                    group: { select: { name: true } },
                },
            },
            messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                    author: { select: { id: true, name: true } },
                },
            },
        },
    });

    for (const thread of threads) {
        const channelName = getChannelName(thread.channel);
        const lastMsg = thread.messages[0];

        // Add thread creation if recent
        if (isRecent(thread.createdAt)) {
            activities.push({
                id: `thread-${thread.id}`,
                type: "new_thread",
                timestamp: thread.createdAt.toISOString(),
                actor: {
                    id: thread.createdBy.id,
                    name: thread.createdBy.name,
                },
                details: {
                    threadId: thread.id,
                    threadSubject: thread.subject,
                    channelType: thread.channel.type as CommsChannelType,
                    channelName,
                },
                isRead: true, // Simplified
            });
        }

        // Add last message activity
        if (lastMsg && isRecent(lastMsg.createdAt)) {
            activities.push({
                id: `msg-${lastMsg.id}`,
                type: "new_message",
                timestamp: lastMsg.createdAt.toISOString(),
                actor: {
                    id: lastMsg.author.id,
                    name: lastMsg.author.name,
                },
                details: {
                    threadId: thread.id,
                    threadSubject: thread.subject,
                    channelType: thread.channel.type as CommsChannelType,
                    channelName,
                    contentPreview: lastMsg.content.substring(0, 100),
                },
                isRead: true, // Simplified
            });
        }
    }

    // 2. Fetch mentions
    const mentions = await prisma.commsMention.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            message: {
                include: {
                    author: { select: { id: true, name: true } },
                    thread: {
                        include: {
                            channel: {
                                include: {
                                    mission: { select: { name: true } },
                                    client: { select: { name: true } },
                                    campaign: { select: { name: true } },
                                    group: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    for (const mention of mentions) {
        const thread = mention.message.thread;
        activities.push({
            id: `mention-${mention.id}`,
            type: "mention",
            timestamp: mention.createdAt.toISOString(),
            actor: {
                id: mention.message.author.id,
                name: mention.message.author.name,
            },
            details: {
                threadId: thread.id,
                threadSubject: thread.subject,
                channelType: thread.channel.type as CommsChannelType,
                channelName: getChannelName(thread.channel),
                contentPreview: mention.message.content.substring(0, 100),
            },
            isRead: mention.notified,
        });
    }

    // Sort combined activities by timestamp desc
    return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
}

// Helper to check if date is within last 7 days
function isRecent(date: Date): boolean {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return date > sevenDaysAgo;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getChannelName(channel: any): string {
    switch (channel.type) {
        case "MISSION": return channel.mission?.name || "Mission";
        case "CLIENT": return channel.client?.name || "Client";
        case "CAMPAIGN": return channel.campaign?.name || "Campagne";
        case "GROUP": return channel.group?.name || channel.name || "Groupe";
        case "DIRECT": return "Direct";
        case "BROADCAST": return "Annonce";
        default: return "";
    }
}
