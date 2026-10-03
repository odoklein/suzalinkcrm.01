// ============================================
// INTERNAL COMMUNICATION SERVICE
// Business logic for the comms module
// ============================================

import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { storageService } from "@/lib/storage/storage-service";
import type { UserRole, Prisma } from "@prisma/client";

/** Comms inbox path per role so notification links work when user clicks */
function getCommsLinkForRole(role: UserRole): string {
    switch (role) {
        case "MANAGER": return "/manager/comms";
        case "SDR": return "/sdr/comms";
        case "BUSINESS_DEVELOPER": return "/bd/comms";
        case "CLIENT": return "/client/contact";
        case "DEVELOPER": return "/developer/comms";
        default: return "/sdr/comms";
    }
}
import type {
    CommsChannelType,
    CommsThreadStatus,
    CreateThreadRequest,
    CreateMessageRequest,
    CreateGroupRequest,
    UpdateGroupRequest,
    CommsThreadListItem,
    CommsThreadView,
    CommsMessageView,
    CommsGroupView,
    CommsInboxStats,
    CommsInboxFilters,
    BroadcastAudience,
} from "./types";

const CLIENT_SUPPORT_DISPLAY_NAME = "Equipe support";

// ============================================
// CHANNEL MANAGEMENT
// ============================================

/**
 * Get or create a channel for a CRM object.
 * Channels are lazily created when the first thread is started.
 */
export async function getOrCreateChannel(
    type: CommsChannelType,
    anchorId?: string
): Promise<string> {
    // For DIRECT and GROUP types, anchorId handling is different
    if (type === "DIRECT") {
        throw new Error("Use getOrCreateDirectChannel for DIRECT channels");
    }

    const whereClause: Prisma.CommsChannelWhereUniqueInput = {
        ...(type === "MISSION" && anchorId && { missionId: anchorId }),
        ...(type === "CLIENT" && anchorId && { clientId: anchorId }),
        ...(type === "CAMPAIGN" && anchorId && { campaignId: anchorId }),
        ...(type === "GROUP" && anchorId && { groupId: anchorId }),
        ...(type === "BROADCAST" && { type_missionId: { type: "BROADCAST", missionId: null } }),
    };

    // Try to find existing channel
    let channel = await prisma.commsChannel.findFirst({
        where: {
            type,
            ...(type === "MISSION" && { missionId: anchorId }),
            ...(type === "CLIENT" && { clientId: anchorId }),
            ...(type === "CAMPAIGN" && { campaignId: anchorId }),
            ...(type === "GROUP" && { groupId: anchorId }),
            ...(type === "BROADCAST" && { type: "BROADCAST" }),
        },
    });

    if (channel) return channel.id;

    // Create new channel
    channel = await prisma.commsChannel.create({
        data: {
            type,
            ...(type === "MISSION" && { missionId: anchorId }),
            ...(type === "CLIENT" && { clientId: anchorId }),
            ...(type === "CAMPAIGN" && { campaignId: anchorId }),
            ...(type === "GROUP" && { groupId: anchorId }),
        },
    });

    return channel.id;
}

/**
 * Get or create a direct channel between two users.
 * Uses sorted user IDs to ensure consistency.
 */
export async function getOrCreateDirectChannel(
    userId1: string,
    userId2: string
): Promise<string> {
    const sortedIds = [userId1, userId2].sort();

    // Try to find existing channel
    let channel = await prisma.commsChannel.findFirst({
        where: {
            type: "DIRECT",
            directUserIds: { equals: sortedIds },
        },
    });

    if (channel) return channel.id;

    // Create new channel
    channel = await prisma.commsChannel.create({
        data: {
            type: "DIRECT",
            directUserIds: sortedIds,
        },
    });

    return channel.id;
}

/**
 * Get or create a direct channel for a set of users.
 * Uses sorted unique user IDs to ensure consistent lookup key.
 */
export async function getOrCreateDirectChannelForUsers(
    userIds: string[]
): Promise<string> {
    const sortedIds = [...new Set(userIds)].sort();
    if (sortedIds.length < 2) {
        throw new Error("Direct channel requires at least two users");
    }

    let channel = await prisma.commsChannel.findFirst({
        where: {
            type: "DIRECT",
            directUserIds: { equals: sortedIds },
        },
    });

    if (channel) return channel.id;

    channel = await prisma.commsChannel.create({
        data: {
            type: "DIRECT",
            directUserIds: sortedIds,
        },
    });

    return channel.id;
}

// ============================================
// THREAD MANAGEMENT
// ============================================

/**
 * Create a new thread with an initial message.
 */
export async function createThread(
    request: CreateThreadRequest,
    creatorId: string
): Promise<string> {
    let channelId: string;

    // Get or create the appropriate channel
    if (request.channelType === "DIRECT") {
        if (!request.participantIds || request.participantIds.length < 1) {
            throw new Error("Direct threads require at least one recipient");
        }
        channelId = await getOrCreateDirectChannelForUsers([creatorId, ...request.participantIds]);
    } else if (request.channelType === "BROADCAST") {
        // Broadcasts get their own channel or use a shared broadcast channel
        channelId = await getOrCreateChannel("BROADCAST");
    } else {
        if (!request.anchorId) {
            throw new Error(`${request.channelType} threads require an anchorId`);
        }
        channelId = await getOrCreateChannel(request.channelType, request.anchorId);
    }

    // Determine participants
    let participantIds: string[] = [creatorId];

    if (request.channelType === "DIRECT" && request.participantIds) {
        participantIds = [...new Set([...participantIds, ...request.participantIds])];
    } else if (request.channelType === "MISSION" && request.anchorId) {
        // Auto-add participants for mission threads:
        // - All SDRs assigned to the mission
        // - All Managers
        // - All BDs who have the client in their portfolio
        // - All Client users for that client
        const mission = await prisma.mission.findUnique({
            where: { id: request.anchorId },
            include: {
                sdrAssignments: {
                    select: { sdrId: true },
                },
                client: {
                    include: {
                        bdAssignments: {
                            where: { isActive: true },
                            select: { bdUserId: true },
                        },
                        users: {
                            where: { role: "CLIENT", isActive: true },
                            select: { id: true },
                        },
                    },
                },
            },
        });

        if (mission) {
            const sdrIds = mission.sdrAssignments.map((a) => a.sdrId);
            const bdIds = mission.client.bdAssignments.map((a) => a.bdUserId);
            const clientUserIds = mission.client.users.map((u) => u.id);

            // Get all managers
            const managers = await prisma.user.findMany({
                where: { role: "MANAGER", isActive: true },
                select: { id: true },
            });
            const managerIds = managers.map((m) => m.id);

            // Combine all participant IDs (remove duplicates)
            participantIds = [
                ...new Set([
                    creatorId,
                    ...sdrIds,
                    ...bdIds,
                    ...clientUserIds,
                    ...managerIds,
                ]),
            ];
        }
    } else if (request.channelType === "CLIENT" && request.anchorId) {
        // Auto-add participants for client threads:
        // - All Managers
        // - All BDs who have the client in their portfolio
        // - All Client users for that client
        const client = await prisma.client.findUnique({
            where: { id: request.anchorId },
            include: {
                bdAssignments: {
                    where: { isActive: true },
                    select: { bdUserId: true },
                },
                users: {
                    where: { role: "CLIENT", isActive: true },
                    select: { id: true },
                },
            },
        });

        if (client) {
            const bdIds = client.bdAssignments.map((a) => a.bdUserId);
            const clientUserIds = client.users.map((u) => u.id);

            // Get all managers
            const managers = await prisma.user.findMany({
                where: { role: "MANAGER", isActive: true },
                select: { id: true },
            });
            const managerIds = managers.map((m) => m.id);

            // Combine all participant IDs (remove duplicates)
            participantIds = [
                ...new Set([
                    creatorId,
                    ...bdIds,
                    ...clientUserIds,
                    ...managerIds,
                ]),
            ];
        }
    } else if (request.channelType === "CAMPAIGN" && request.anchorId) {
        // Auto-add participants for campaign threads:
        // - All SDRs assigned to the parent mission
        // - All Managers
        // - All BDs who have the client in their portfolio
        const campaign = await prisma.campaign.findUnique({
            where: { id: request.anchorId },
            include: {
                mission: {
                    include: {
                        sdrAssignments: {
                            select: { sdrId: true },
                        },
                        client: {
                            include: {
                                bdAssignments: {
                                    where: { isActive: true },
                                    select: { bdUserId: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (campaign?.mission) {
            const sdrIds = campaign.mission.sdrAssignments.map((a) => a.sdrId);
            const bdIds = campaign.mission.client.bdAssignments.map((a) => a.bdUserId);

            // Get all managers
            const managers = await prisma.user.findMany({
                where: { role: "MANAGER", isActive: true },
                select: { id: true },
            });
            const managerIds = managers.map((m) => m.id);

            // Combine all participant IDs (remove duplicates)
            participantIds = [
                ...new Set([
                    creatorId,
                    ...sdrIds,
                    ...bdIds,
                    ...managerIds,
                ]),
            ];
        }
    } else if (request.channelType === "GROUP" && request.anchorId) {
        // Auto-add all group members
        const group = await prisma.commsGroup.findUnique({
            where: { id: request.anchorId },
            include: {
                members: {
                    select: { userId: true },
                },
            },
        });

        if (group) {
            const memberIds = group.members.map((m) => m.userId);
            participantIds = [
                ...new Set([
                    creatorId,
                    ...memberIds,
                ]),
            ];
        }
    } else if (request.channelType === "BROADCAST") {
        // For broadcasts, add all active users (or filter by audience if specified)
        const allUsers = await prisma.user.findMany({
            where: { isActive: true },
            select: { id: true },
        });
        participantIds = allUsers.map((u) => u.id);
    }

    // Create thread with initial message in a transaction
    const thread = await prisma.$transaction(async (tx) => {
        // Create thread
        const newThread = await tx.commsThread.create({
            data: {
                channelId,
                subject: request.subject,
                createdById: creatorId,
                isBroadcast: request.isBroadcast || false,
                broadcastAudience: request.broadcastAudience as Prisma.InputJsonValue,
                messageCount: 1,
                lastMessageAt: new Date(),
                lastMessageById: creatorId,
            },
        });

        // Add participants
        await tx.commsParticipant.createMany({
            data: participantIds.map((userId) => ({
                threadId: newThread.id,
                userId,
                unreadCount: userId === creatorId ? 0 : 1,
            })),
        });

        // Create initial message
        await tx.commsMessage.create({
            data: {
                threadId: newThread.id,
                authorId: creatorId,
                type: request.isBroadcast ? "BROADCAST" : "TEXT",
                content: request.initialMessage,
            },
        });

        return newThread;
    });

    // Send notifications to participants (except creator) — use sender name, not subject
    const creator = await prisma.user.findUnique({
        where: { id: creatorId },
        select: { name: true },
    });
    const creatorName = creator?.name ?? "Quelqu'un";

    const otherParticipantIds = participantIds.filter((id) => id !== creatorId);
    const otherParticipantsWithRole = otherParticipantIds.length
        ? await prisma.user.findMany({
              where: { id: { in: otherParticipantIds } },
              select: { id: true, role: true },
          })
        : [];

    const isDirect = request.channelType === "DIRECT" || request.subject.startsWith("Message avec ");
    const preview = request.initialMessage
        ? truncateContent(request.initialMessage, 40)
        : "";

    for (const u of otherParticipantsWithRole) {
        const messageText = request.isBroadcast
            ? request.subject
            : isDirect
              ? preview
                ? `${creatorName} vous a envoyé un message : ${preview}`
                : `${creatorName} vous a envoyé un message`
              : `${creatorName} : ${request.subject}`;

        await createNotification({
            userId: u.id,
            title: request.isBroadcast ? "Nouvelle annonce" : "Nouveau message",
            message: messageText,
            type: "info",
            link: `${getCommsLinkForRole(u.role)}?thread=${thread.id}`,
        });
    }

    return thread.id;
}

/**
 * Get threads for the current user's inbox.
 */
export async function getInboxThreads(
    userId: string,
    filters: CommsInboxFilters = {},
    page = 1,
    pageSize = 20
): Promise<{ threads: CommsThreadListItem[]; total: number }> {
    const skip = (page - 1) * pageSize;
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    const isClientViewer = currentUser?.role === "CLIENT";

    // Base where clause - user must be a participant
    const baseWhere: Prisma.CommsThreadWhereInput = {
        participants: {
            some: { userId },
        },
        status: filters.status || { not: "ARCHIVED" },
        ...(filters.type && {
            channel: { type: filters.type },
        }),
        ...(filters.unreadOnly && {
            participants: {
                some: {
                    userId,
                    unreadCount: { gt: 0 },
                },
            },
        }),
        ...(filters.search && {
            OR: [
                { subject: { contains: filters.search, mode: "insensitive" } },
                {
                    messages: {
                        some: {
                            content: { contains: filters.search, mode: "insensitive" },
                        },
                    },
                },
            ],
        }),
    };

    const [threads, total] = await Promise.all([
        prisma.commsThread.findMany({
            where: baseWhere,
            include: {
                channel: {
                    include: {
                        mission: { select: { id: true, name: true } },
                        client: { select: { id: true, name: true } },
                        campaign: { select: { id: true, name: true } },
                        group: { select: { id: true, name: true } },
                    },
                },
                createdBy: { select: { id: true, name: true } },
                participants: {
                    select: { userId: true, unreadCount: true, user: { select: { id: true, name: true } } },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        author: { select: { id: true, name: true } },
                    },
                },
                _count: { select: { participants: true } },
            },
            orderBy: { lastMessageAt: "desc" },
            skip,
            take: pageSize,
        }),
        prisma.commsThread.count({ where: baseWhere }),
    ]);

    return {
        threads: await Promise.all(threads.map(async (thread) => {
            const currentParticipant = thread.participants.find((p) => p.userId === userId);
            const otherParticipant = thread.participants.find((p) => p.userId !== userId);
            const isDirect = thread.channel.type === "DIRECT";
            const maskedDirectForClient = isClientViewer && isDirect;
            const lastMessage = thread.messages[0];
            const maskedAuthorName =
                maskedDirectForClient && lastMessage && lastMessage.author.id !== userId
                    ? CLIENT_SUPPORT_DISPLAY_NAME
                    : lastMessage?.author.name;
            return {
                id: thread.id,
                channelId: thread.channelId,
                channelType: thread.channel.type as CommsChannelType,
                channelName: maskedDirectForClient
                    ? CLIENT_SUPPORT_DISPLAY_NAME
                    : await getChannelName(thread.channel),
                subject: maskedDirectForClient
                    ? `Message avec ${CLIENT_SUPPORT_DISPLAY_NAME}`
                    : thread.subject,
                status: thread.status as CommsThreadStatus,
                isBroadcast: thread.isBroadcast,
                createdBy: {
                    id: thread.createdBy.id,
                    name: thread.createdBy.name,
                },
                ...(isDirect &&
                    (maskedDirectForClient
                        ? { otherParticipantName: CLIENT_SUPPORT_DISPLAY_NAME }
                        : otherParticipant?.user?.name != null
                            ? { otherParticipantName: otherParticipant.user.name }
                            : {})),
                participantCount: thread._count.participants,
                messageCount: thread.messageCount,
                unreadCount: currentParticipant?.unreadCount ?? 0,
                lastMessage: lastMessage
                    ? {
                        content: truncateContent(lastMessage.content, 100),
                        authorName: maskedAuthorName ?? lastMessage.author.name,
                        createdAt: lastMessage.createdAt.toISOString(),
                    }
                    : undefined,
                createdAt: thread.createdAt.toISOString(),
                updatedAt: thread.updatedAt.toISOString(),
            };
        })),
        total,
    };
}

/**
 * Get a single thread with all messages.
 */
export async function getThread(
    threadId: string,
    userId: string
): Promise<CommsThreadView | null> {
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    const isClientViewer = currentUser?.role === "CLIENT";

    const thread = await prisma.commsThread.findFirst({
        where: {
            id: threadId,
            participants: { some: { userId } },
        },
        include: {
            channel: {
                include: {
                    mission: { select: { id: true, name: true } },
                    client: { select: { id: true, name: true } },
                    campaign: { select: { id: true, name: true } },
                    group: { select: { id: true, name: true } },
                },
            },
            createdBy: { select: { id: true, name: true } },
            participants: {
                include: {
                    user: { select: { id: true, name: true, role: true } },
                },
            },
            messages: {
                where: { isDeleted: false },
                orderBy: { createdAt: "asc" },
                include: {
                    author: { select: { id: true, name: true, role: true } },
                    mentions: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                    attachments: true,
                    readReceipts: {
                        include: {
                            user: { select: { id: true, name: true } },
                        },
                    },
                    reactions: true,
                },
            },
        },
    });

    if (!thread) return null;
    const isDirect = thread.channel.type === "DIRECT";
    const maskedDirectForClient = isClientViewer && isDirect;

    // Mark as read
    await prisma.commsParticipant.update({
        where: {
            threadId_userId: { threadId, userId },
        },
        data: {
            lastReadAt: new Date(),
            unreadCount: 0,
        },
    });

    // Upsert read receipts for current user for all messages
    try {
        await prisma.commsMessageReadReceipt.createMany({
            data: thread.messages.map((m) => ({
                messageId: m.id,
                userId,
            })),
            skipDuplicates: true,
        });
    } catch {
        /* table may not exist yet if migration not applied */
    }

    return {
        id: thread.id,
        channelId: thread.channelId,
        channelType: thread.channel.type as CommsChannelType,
        channelName: maskedDirectForClient
            ? CLIENT_SUPPORT_DISPLAY_NAME
            : await getChannelName(thread.channel),
        subject: maskedDirectForClient
            ? `Message avec ${CLIENT_SUPPORT_DISPLAY_NAME}`
            : thread.subject,
        status: thread.status as CommsThreadStatus,
        isBroadcast: thread.isBroadcast,
        createdBy: {
            id: thread.createdBy.id,
            name: thread.createdBy.name,
        },
        participantCount: thread.participants.length,
        messageCount: thread.messageCount,
        unreadCount: 0, // Just marked as read
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        participants: thread.participants.map((p) => ({
            id: p.id,
            userId: p.user.id,
            userName:
                maskedDirectForClient && p.user.id !== userId
                    ? CLIENT_SUPPORT_DISPLAY_NAME
                    : p.user.name,
            userRole: p.user.role,
            lastReadAt: p.lastReadAt?.toISOString(),
            unreadCount: p.unreadCount,
            isMuted: p.isMuted,
            joinedAt: p.joinedAt.toISOString(),
        })),
        messages: thread.messages.map((m) => ({
            id: m.id,
            threadId: m.threadId,
            type: m.type as "TEXT" | "SYSTEM" | "BROADCAST",
            content: m.content,
            author: {
                id: m.author.id,
                name:
                    maskedDirectForClient && m.author.id !== userId
                        ? CLIENT_SUPPORT_DISPLAY_NAME
                        : m.author.name,
                role: m.author.role,
                initials: getInitials(
                    maskedDirectForClient && m.author.id !== userId
                        ? CLIENT_SUPPORT_DISPLAY_NAME
                        : m.author.name
                ),
            },
            mentions: m.mentions.map((mention) => ({
                userId: mention.user.id,
                userName: mention.user.name,
            })),
            attachments: m.attachments.map((a) => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
                url: a.url || undefined,
            })),
            readBy: (m as { readReceipts?: { user: { id: string; name: string }; readAt: Date }[] }).readReceipts
                ?.filter((r) => r.user.id !== m.authorId)
                .map((r) => ({
                    userId: r.user.id,
                    userName: r.user.name,
                    readAt: (r.readAt as Date).toISOString(),
                })),
            reactions: aggregateReactions(
                (m as { reactions?: { emoji: string; userId: string }[] }).reactions ?? [],
                userId
            ),
            isEdited: m.isEdited,
            isDeleted: m.isDeleted,
            isOwnMessage: m.authorId === userId,
            createdAt: m.createdAt.toISOString(),
        })),
    };
}

/**
 * Update thread status.
 */
export async function updateThreadStatus(
    threadId: string,
    status: CommsThreadStatus,
    userId: string
): Promise<void> {
    // Verify user is participant or manager
    const thread = await prisma.commsThread.findFirst({
        where: {
            id: threadId,
            participants: { some: { userId } },
        },
    });

    if (!thread) {
        throw new Error("Thread not found or access denied");
    }

    await prisma.commsThread.update({
        where: { id: threadId },
        data: { status },
    });

    // Add system message
    await prisma.commsMessage.create({
        data: {
            threadId,
            authorId: userId,
            type: "SYSTEM",
            content: `Discussion marquée comme ${status === "RESOLVED" ? "résolue" : "archivée"}`,
        },
    });
}

// ============================================
// MESSAGE MANAGEMENT
// ============================================

/**
 * Add a message to a thread.
 */
export async function addMessage(
    request: CreateMessageRequest,
    authorId: string
): Promise<string> {
    // Verify user is participant
    const participant = await prisma.commsParticipant.findUnique({
        where: {
            threadId_userId: { threadId: request.threadId, userId: authorId },
        },
    });

    if (!participant) {
        throw new Error("You are not a participant in this thread");
    }

    const message = await prisma.$transaction(async (tx) => {
        // Create message
        const newMessage = await tx.commsMessage.create({
            data: {
                threadId: request.threadId,
                authorId,
                content: request.content,
                type: "TEXT",
            },
        });

        // Add mentions if any
        if (request.mentionIds && request.mentionIds.length > 0) {
            await tx.commsMention.createMany({
                data: request.mentionIds.map((userId) => ({
                    messageId: newMessage.id,
                    userId,
                })),
            });
        }

        // Update thread metadata
        await tx.commsThread.update({
            where: { id: request.threadId },
            data: {
                messageCount: { increment: 1 },
                lastMessageAt: new Date(),
                lastMessageById: authorId,
            },
        });

        // Increment unread count for other participants
        await tx.commsParticipant.updateMany({
            where: {
                threadId: request.threadId,
                userId: { not: authorId },
            },
            data: {
                unreadCount: { increment: 1 },
            },
        });

        return newMessage;
    });

    // Send notifications to other participants (and fix link per role)
    const thread = await prisma.commsThread.findUnique({
        where: { id: request.threadId },
        include: {
            createdBy: { select: { name: true } },
            channel: { select: { type: true } },
            participants: {
                where: { userId: { not: authorId }, isMuted: false },
                include: { user: { select: { id: true, role: true } } },
            },
        },
    });

    const senderName = thread?.createdBy?.name ?? "Quelqu'un";
    const isDirect = thread?.channel?.type === "DIRECT";
    const preview = truncateContent(request.content, 50);
    const notificationTitle = isDirect ? "Nouveau message direct" : "Nouveau message";
    const notificationMessage = isDirect
        ? `${senderName}: ${preview}`
        : `${senderName} dans « ${thread?.subject ?? "Discussion" } » : ${preview}`;

    if (thread) {
        for (const p of thread.participants) {
            const link = `${getCommsLinkForRole(p.user.role)}?thread=${request.threadId}`;
            await createNotification({
                userId: p.userId,
                title: notificationTitle,
                message: notificationMessage,
                type: "info",
                link,
            });
        }
    }

    // Notify mentioned users (with role-based link)
    if (request.mentionIds && thread) {
        const mentionedUsers = await prisma.user.findMany({
            where: { id: { in: request.mentionIds } },
            select: { id: true, role: true },
        });
        for (const u of mentionedUsers) {
            const link = `${getCommsLinkForRole(u.role)}?thread=${request.threadId}`;
            await createNotification({
                userId: u.id,
                title: "Vous avez été mentionné",
                message: `${senderName} dans « ${thread.subject } »`,
                type: "info",
                link,
            });
        }
    }

    return message.id;
}

const COMMS_ATTACHMENT_ALLOWED_TYPES = [
    "image/*",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
];
const COMMS_ATTACHMENT_MAX_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Add attachments to an existing message. Uploads to storage and creates CommsAttachment records.
 */
export async function addAttachmentsToMessage(
    messageId: string,
    files: { buffer: Buffer; filename: string; mimeType: string; size: number }[],
    userId: string
): Promise<void> {
    if (files.length === 0) return;
    for (const f of files) {
        if (f.size > COMMS_ATTACHMENT_MAX_SIZE) {
            throw new Error(`Fichier trop volumineux: ${f.filename} (max 15 Mo)`);
        }
        if (!storageService.isAllowedType(f.mimeType, COMMS_ATTACHMENT_ALLOWED_TYPES)) {
            throw new Error(`Type non autorisé: ${f.filename}`);
        }
    }
    const folder = "comms";
    for (const f of files) {
        const { key, url } = await storageService.upload(
            f.buffer,
            { filename: f.filename, mimeType: f.mimeType, size: f.size, folder },
            userId
        );
        await prisma.commsAttachment.create({
            data: {
                messageId,
                filename: f.filename,
                mimeType: f.mimeType,
                size: f.size,
                storageKey: key,
                url,
            },
        });
    }
}

/**
 * Toggle a reaction on a message. If user already reacted with this emoji, remove it; otherwise add it.
 */
export async function addOrRemoveReaction(
    messageId: string,
    userId: string,
    emoji: string
): Promise<"added" | "removed"> {
    const message = await prisma.commsMessage.findUnique({
        where: { id: messageId },
        select: { threadId: true },
    });
    if (!message) throw new Error("Message not found");

    const participant = await prisma.commsParticipant.findUnique({
        where: {
            threadId_userId: { threadId: message.threadId, userId },
        },
    });
    if (!participant) throw new Error("Not a participant");

    const allowed = ["👍", "❤️", "😂", "🎉", "👀", "🔥"];
    if (!allowed.includes(emoji)) throw new Error("Invalid emoji");

    const existing = await prisma.commsMessageReaction.findUnique({
        where: {
            messageId_userId_emoji: { messageId, userId, emoji },
        },
    });

    if (existing) {
        await prisma.commsMessageReaction.delete({
            where: { id: existing.id },
        });
        return "removed";
    }

    await prisma.commsMessageReaction.create({
        data: { messageId, userId, emoji },
    });
    return "added";
}

/**
 * Edit a message (only within 5 minutes of creation).
 */
export async function editMessage(
    messageId: string,
    content: string,
    userId: string
): Promise<void> {
    const message = await prisma.commsMessage.findUnique({
        where: { id: messageId },
    });

    if (!message) {
        throw new Error("Message not found");
    }

    if (message.authorId !== userId) {
        throw new Error("You can only edit your own messages");
    }

    // Check if within 5-minute edit window
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
        throw new Error("Messages can only be edited within 5 minutes of posting");
    }

    await prisma.commsMessage.update({
        where: { id: messageId },
        data: {
            content,
            isEdited: true,
            editedAt: new Date(),
        },
    });
}

/**
 * Soft delete a message.
 */
export async function deleteMessage(
    messageId: string,
    userId: string,
    isManager = false
): Promise<void> {
    const message = await prisma.commsMessage.findUnique({
        where: { id: messageId },
    });

    if (!message) {
        throw new Error("Message not found");
    }

    // Only author (within 5 min) or managers can delete
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const canDelete =
        isManager || (message.authorId === userId && message.createdAt >= fiveMinutesAgo);

    if (!canDelete) {
        throw new Error("You cannot delete this message");
    }

    await prisma.commsMessage.update({
        where: { id: messageId },
        data: {
            isDeleted: true,
            deletedAt: new Date(),
            content: "[Message supprimé]",
        },
    });
}

// ============================================
// GROUP MANAGEMENT
// ============================================

/**
 * Create a new communication group.
 */
export async function createGroup(
    request: CreateGroupRequest,
    creatorId: string
): Promise<string> {
    const group = await prisma.$transaction(async (tx) => {
        // Create group
        const newGroup = await tx.commsGroup.create({
            data: {
                name: request.name,
                description: request.description,
                createdById: creatorId,
            },
        });

        // Add creator as admin
        const allMemberIds = [...new Set([creatorId, ...request.memberIds])];
        await tx.commsGroupMember.createMany({
            data: allMemberIds.map((userId) => ({
                groupId: newGroup.id,
                userId,
                role: userId === creatorId ? "admin" : "member",
            })),
        });

        // Create channel for the group
        await tx.commsChannel.create({
            data: {
                type: "GROUP",
                groupId: newGroup.id,
                name: request.name,
            },
        });

        return newGroup;
    });

    return group.id;
}

/**
 * Get groups for a user.
 */
export async function getUserGroups(userId: string): Promise<CommsGroupView[]> {
    const groups = await prisma.commsGroup.findMany({
        where: {
            members: { some: { userId } },
            isActive: true,
        },
        include: {
            createdBy: { select: { id: true, name: true } },
            members: {
                include: {
                    user: { select: { id: true, name: true } },
                },
            },
            _count: { select: { members: true } },
        },
        orderBy: { name: "asc" },
    });

    return groups.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description || undefined,
        memberCount: g._count.members,
        members: g.members.map((m) => ({
            id: m.id,
            userId: m.user.id,
            userName: m.user.name,
            role: m.role,
        })),
        createdBy: {
            id: g.createdBy.id,
            name: g.createdBy.name,
        },
        createdAt: g.createdAt.toISOString(),
    }));
}

/**
 * Add members to a group.
 */
export async function addGroupMembers(
    groupId: string,
    memberIds: string[],
    requesterId: string
): Promise<void> {
    // Verify requester is admin
    const requesterMembership = await prisma.commsGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: requesterId } },
    });

    if (!requesterMembership || requesterMembership.role !== "admin") {
        throw new Error("Only group admins can add members");
    }

    await prisma.commsGroupMember.createMany({
        data: memberIds.map((userId) => ({
            groupId,
            userId,
            role: "member",
        })),
        skipDuplicates: true,
    });
}

/**
 * Remove a member from a group.
 */
export async function removeGroupMember(
    groupId: string,
    memberId: string,
    requesterId: string
): Promise<void> {
    // Verify requester is admin
    const requesterMembership = await prisma.commsGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: requesterId } },
    });

    if (!requesterMembership || requesterMembership.role !== "admin") {
        throw new Error("Only group admins can remove members");
    }

    await prisma.commsGroupMember.delete({
        where: { groupId_userId: { groupId, userId: memberId } },
    });
}

// ============================================
// INBOX STATS
// ============================================

/**
 * Get inbox statistics for a user.
 */
export async function getInboxStats(userId: string): Promise<CommsInboxStats> {
    const [unreadByType, mentionCount] = await Promise.all([
        // Unread counts by channel type
        prisma.$queryRaw<{ type: string; count: bigint }[]>`
            SELECT cc.type, COUNT(DISTINCT ct.id)::bigint as count
            FROM "CommsThread" ct
            JOIN "CommsChannel" cc ON ct."channelId" = cc.id
            JOIN "CommsParticipant" cp ON ct.id = cp."threadId"
            WHERE cp."userId" = ${userId}
              AND cp."unreadCount" > 0
              AND ct.status != 'ARCHIVED'
            GROUP BY cc.type
        `,
        // Unread mention count
        prisma.commsMention.count({
            where: {
                userId,
                notified: false,
            },
        }),
    ]);

    const unreadMap: Record<CommsChannelType, number> = {
        MISSION: 0,
        CLIENT: 0,
        CAMPAIGN: 0,
        GROUP: 0,
        DIRECT: 0,
        BROADCAST: 0,
    };

    let totalUnread = 0;
    for (const row of unreadByType) {
        const count = Number(row.count);
        unreadMap[row.type as CommsChannelType] = count;
        totalUnread += count;
    }

    return {
        totalUnread,
        unreadByType: unreadMap,
        mentionCount,
    };
}

// ============================================
// VISIBILITY HELPERS
// ============================================

/**
 * Check if a user can access threads for a given CRM object.
 */
export async function canAccessChannel(
    userId: string,
    userRole: UserRole,
    channelType: CommsChannelType,
    anchorId?: string
): Promise<boolean> {
    // Managers can access everything
    if (userRole === "MANAGER") return true;

    switch (channelType) {
        case "MISSION":
            // SDRs can access if assigned to mission
            if (userRole === "SDR") {
                const assignment = await prisma.sDRAssignment.findFirst({
                    where: { missionId: anchorId, sdrId: userId },
                });
                return !!assignment;
            }
            // BDs can access if client is in portfolio
            if (userRole === "BUSINESS_DEVELOPER") {
                const mission = await prisma.mission.findUnique({
                    where: { id: anchorId },
                    include: {
                        client: {
                            include: {
                                bdAssignments: { where: { bdUserId: userId } },
                            },
                        },
                    },
                });
                return (mission?.client?.bdAssignments?.length ?? 0) > 0;
            }
            // Clients can access missions of their organization
            if (userRole === "CLIENT") {
                const mission = await prisma.mission.findUnique({
                    where: { id: anchorId },
                    include: {
                        client: {
                            include: {
                                users: { where: { id: userId }, select: { id: true } },
                            },
                        },
                    },
                });
                return (mission?.client?.users?.length ?? 0) > 0;
            }
            return false;

        case "CLIENT":
            // BDs with client in portfolio
            if (userRole === "BUSINESS_DEVELOPER") {
                const bdClient = await prisma.businessDeveloperClient.findFirst({
                    where: { bdUserId: userId, clientId: anchorId },
                });
                return !!bdClient;
            }
            // Client users can access their own organization's channel
            if (userRole === "CLIENT") {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { clientId: true },
                });
                return user?.clientId === anchorId;
            }
            return false;

        case "CAMPAIGN":
            // SDRs if assigned to parent mission
            if (userRole === "SDR") {
                const campaign = await prisma.campaign.findUnique({
                    where: { id: anchorId },
                    include: {
                        mission: {
                            include: {
                                sdrAssignments: { where: { sdrId: userId } },
                            },
                        },
                    },
                });
                return (campaign?.mission?.sdrAssignments?.length ?? 0) > 0;
            }
            // BDs with client in portfolio
            if (userRole === "BUSINESS_DEVELOPER") {
                const campaign = await prisma.campaign.findUnique({
                    where: { id: anchorId },
                    include: {
                        mission: {
                            include: {
                                client: {
                                    include: {
                                        bdAssignments: { where: { bdUserId: userId } },
                                    },
                                },
                            },
                        },
                    },
                });
                return (campaign?.mission?.client?.bdAssignments?.length ?? 0) > 0;
            }
            return false;

        case "DIRECT":
        case "GROUP":
            // Handled by participant check in thread queries
            return true;

        case "BROADCAST":
            // Everyone can read broadcasts
            return true;

        default:
            return false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function getChannelName(channel: {
    type: string;
    name?: string | null;
    missionId?: string | null;
    clientId?: string | null;
    campaignId?: string | null;
    groupId?: string | null;
    mission?: { name: string } | null;
    client?: { name: string } | null;
    campaign?: { name: string } | null;
    group?: { name: string } | null;
}): Promise<string> {
    if (channel.name) return channel.name;

    // Use included relations if available
    switch (channel.type) {
        case "MISSION":
            if (channel.mission) return channel.mission.name;
            // Fallback: fetch if not included
            if (channel.missionId) {
                const mission = await prisma.mission.findUnique({
                    where: { id: channel.missionId },
                    select: { name: true },
                });
                return mission?.name || "Mission";
            }
            return "Mission";
        case "CLIENT":
            if (channel.client) return channel.client.name;
            // Fallback: fetch if not included
            if (channel.clientId) {
                const client = await prisma.client.findUnique({
                    where: { id: channel.clientId },
                    select: { name: true },
                });
                return client?.name || "Client";
            }
            return "Client";
        case "CAMPAIGN":
            if (channel.campaign) return channel.campaign.name;
            // Fallback: fetch if not included
            if (channel.campaignId) {
                const campaign = await prisma.campaign.findUnique({
                    where: { id: channel.campaignId },
                    select: { name: true },
                });
                return campaign?.name || "Campagne";
            }
            return "Campagne";
        case "GROUP":
            if (channel.group) return channel.group.name;
            // Fallback: fetch if not included
            if (channel.groupId) {
                const group = await prisma.commsGroup.findUnique({
                    where: { id: channel.groupId },
                    select: { name: true },
                });
                return group?.name || "Groupe";
            }
            return "Groupe";
        case "DIRECT":
            return "Message direct";
        case "BROADCAST":
            return "Annonces";
        default:
            return "Discussion";
    }
}

function truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength - 3) + "...";
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase()
        .substring(0, 2);
}

function aggregateReactions(
    reactions: { emoji: string; userId: string }[],
    currentUserId: string
): { emoji: string; count: number; userIds: string[] }[] {
    const byEmoji = new Map<string, string[]>();
    for (const r of reactions) {
        const arr = byEmoji.get(r.emoji) ?? [];
        if (!arr.includes(r.userId)) arr.push(r.userId);
        byEmoji.set(r.emoji, arr);
    }
    return Array.from(byEmoji.entries()).map(([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        userIds,
    }));
}
