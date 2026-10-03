// ============================================
// COMMS SEARCH SERVICE
// Full-text search across messages and threads
// ============================================

import { prisma } from "@/lib/prisma";
import type { CommsChannelType, CommsThreadStatus } from "./types";

// ============================================
// TYPES
// ============================================

export interface CommsSearchFilters {
    query: string;
    channelType?: CommsChannelType;
    authorId?: string;
    fromDate?: Date;
    toDate?: Date;
    threadId?: string; // Search within specific thread
    status?: CommsThreadStatus;
}

export interface CommsSearchResult {
    id: string;
    type: "message" | "thread";
    threadId: string;
    threadSubject: string;
    channelType: CommsChannelType;
    channelName: string;
    content: string;
    highlightedContent: string;
    author: {
        id: string;
        name: string;
    };
    createdAt: string;
    matchPositions: { start: number; end: number }[];
}

export interface CommsSearchResponse {
    results: CommsSearchResult[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================
// SEARCH FUNCTIONS
// ============================================

/**
 * Search messages across all threads the user has access to.
 */
export async function searchCommsMessages(
    userId: string,
    filters: CommsSearchFilters,
    page = 1,
    pageSize = 20
): Promise<CommsSearchResponse> {
    const { query, channelType, authorId, fromDate, toDate, threadId, status } = filters;

    if (!query || query.trim().length < 2) {
        return { results: [], total: 0, page, pageSize, hasMore: false };
    }

    const searchTerm = query.trim().toLowerCase();
    const skip = (page - 1) * pageSize;

    // Build where clause for threads the user participates in
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threadWhere: any = {
        participants: {
            some: { userId },
        },
    };

    if (threadId) {
        threadWhere.id = threadId;
    }

    if (status) {
        threadWhere.status = status;
    }

    if (channelType) {
        threadWhere.channel = {
            type: channelType,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageWhere: any = {
        thread: threadWhere,
        isDeleted: false,
        content: {
            contains: searchTerm,
            mode: "insensitive",
        },
    };

    if (authorId) {
        messageWhere.authorId = authorId;
    }

    if (fromDate) {
        messageWhere.createdAt = {
            ...messageWhere.createdAt,
            gte: fromDate,
        };
    }

    if (toDate) {
        messageWhere.createdAt = {
            ...messageWhere.createdAt,
            lte: toDate,
        };
    }

    // Count total matches
    const total = await prisma.commsMessage.count({
        where: messageWhere,
    });

    // Fetch matching messages with thread and channel context
    const messages = await prisma.commsMessage.findMany({
        where: messageWhere,
        include: {
            author: {
                select: { id: true, name: true },
            },
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
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
    });

    // Transform to search results with highlighting
    const results: CommsSearchResult[] = messages.map((msg) => {
        const thread = msg.thread;
        const channel = thread.channel;

        // Determine channel name
        let channelName = "";
        switch (channel.type) {
            case "MISSION":
                channelName = channel.mission?.name || "Mission";
                break;
            case "CLIENT":
                channelName = channel.client?.name || "Client";
                break;
            case "CAMPAIGN":
                channelName = channel.campaign?.name || "Campagne";
                break;
            case "GROUP":
                channelName = channel.group?.name || channel.name || "Groupe";
                break;
            case "DIRECT":
                channelName = "Direct";
                break;
            case "BROADCAST":
                channelName = "Annonce";
                break;
        }

        // Find match positions for highlighting
        const matchPositions = findMatchPositions(msg.content, searchTerm);
        const highlightedContent = highlightMatches(msg.content, matchPositions);

        return {
            id: msg.id,
            type: "message" as const,
            threadId: thread.id,
            threadSubject: thread.subject,
            channelType: channel.type as CommsChannelType,
            channelName,
            content: msg.content,
            highlightedContent,
            author: {
                id: msg.author.id,
                name: msg.author.name,
            },
            createdAt: msg.createdAt.toISOString(),
            matchPositions,
        };
    });

    return {
        results,
        total,
        page,
        pageSize,
        hasMore: skip + results.length < total,
    };
}

/**
 * Search thread subjects.
 */
export async function searchCommsThreads(
    userId: string,
    filters: CommsSearchFilters,
    page = 1,
    pageSize = 20
): Promise<CommsSearchResponse> {
    const { query, channelType, status } = filters;

    if (!query || query.trim().length < 2) {
        return { results: [], total: 0, page, pageSize, hasMore: false };
    }

    const searchTerm = query.trim().toLowerCase();
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
        participants: {
            some: { userId },
        },
        subject: {
            contains: searchTerm,
            mode: "insensitive",
        },
    };

    if (channelType) {
        where.channel = { type: channelType };
    }

    if (status) {
        where.status = status;
    }

    const total = await prisma.commsThread.count({ where });

    const threads = await prisma.commsThread.findMany({
        where,
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
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
    });

    const results: CommsSearchResult[] = threads.map((thread) => {
        const channel = thread.channel;

        let channelName = "";
        switch (channel.type) {
            case "MISSION":
                channelName = channel.mission?.name || "Mission";
                break;
            case "CLIENT":
                channelName = channel.client?.name || "Client";
                break;
            case "CAMPAIGN":
                channelName = channel.campaign?.name || "Campagne";
                break;
            case "GROUP":
                channelName = channel.group?.name || channel.name || "Groupe";
                break;
            case "DIRECT":
                channelName = "Direct";
                break;
            case "BROADCAST":
                channelName = "Annonce";
                break;
        }

        const matchPositions = findMatchPositions(thread.subject, searchTerm);
        const highlightedContent = highlightMatches(thread.subject, matchPositions);

        return {
            id: thread.id,
            type: "thread" as const,
            threadId: thread.id,
            threadSubject: thread.subject,
            channelType: channel.type as CommsChannelType,
            channelName,
            content: thread.subject,
            highlightedContent,
            author: {
                id: thread.createdBy.id,
                name: thread.createdBy.name,
            },
            createdAt: thread.createdAt.toISOString(),
            matchPositions,
        };
    });

    return {
        results,
        total,
        page,
        pageSize,
        hasMore: skip + results.length < total,
    };
}

/**
 * Combined search across both messages and thread subjects.
 */
export async function searchComms(
    userId: string,
    filters: CommsSearchFilters,
    page = 1,
    pageSize = 20
): Promise<CommsSearchResponse> {
    // Search both messages and threads, then merge results
    const [messageResults, threadResults] = await Promise.all([
        searchCommsMessages(userId, filters, 1, pageSize * 2),
        searchCommsThreads(userId, filters, 1, pageSize),
    ]);

    // Combine and sort by relevance (threads first, then by date)
    const combined = [
        ...threadResults.results.map((r) => ({ ...r, priority: 1 })),
        ...messageResults.results.map((r) => ({ ...r, priority: 2 })),
    ];

    // Sort: threads first (priority 1), then by date descending
    combined.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Remove duplicates (same thread appearing in both results)
    const seen = new Set<string>();
    const deduped = combined.filter((r) => {
        const key = r.type === "thread" ? `thread:${r.id}` : `msg:${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const skip = (page - 1) * pageSize;
    const paginated = deduped.slice(skip, skip + pageSize);
    const total = messageResults.total + threadResults.total;

    return {
        results: paginated.map(({ priority: _, ...r }) => r),
        total,
        page,
        pageSize,
        hasMore: skip + paginated.length < deduped.length,
    };
}

// ============================================
// SAVED SEARCHES
// ============================================

export interface SavedSearchData {
    name: string;
    query: string;
    filters?: {
        channelType?: CommsChannelType;
        authorId?: string;
        fromDate?: string;
        toDate?: string;
        status?: CommsThreadStatus;
    };
}

export async function getSavedSearches(userId: string) {
    return prisma.commsSavedSearch.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
    });
}

export async function createSavedSearch(userId: string, data: SavedSearchData) {
    return prisma.commsSavedSearch.create({
        data: {
            userId,
            name: data.name,
            query: data.query,
            filters: data.filters || {},
        },
    });
}

export async function deleteSavedSearch(userId: string, searchId: string) {
    return prisma.commsSavedSearch.deleteMany({
        where: {
            id: searchId,
            userId, // Ensure user owns the search
        },
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Find all positions where the search term appears in the content.
 */
function findMatchPositions(
    content: string,
    searchTerm: string
): { start: number; end: number }[] {
    const positions: { start: number; end: number }[] = [];
    const lowerContent = content.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();

    let pos = 0;
    while ((pos = lowerContent.indexOf(lowerTerm, pos)) !== -1) {
        positions.push({ start: pos, end: pos + searchTerm.length });
        pos += 1;
    }

    return positions;
}

/**
 * Create an HTML string with matched portions wrapped in <mark> tags.
 */
function highlightMatches(
    content: string,
    positions: { start: number; end: number }[]
): string {
    if (positions.length === 0) return content;

    let result = "";
    let lastEnd = 0;

    for (const { start, end } of positions) {
        result += escapeHtml(content.slice(lastEnd, start));
        result += `<mark>${escapeHtml(content.slice(start, end))}</mark>`;
        lastEnd = end;
    }

    result += escapeHtml(content.slice(lastEnd));
    return result;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
