// ============================================
// INTERNAL COMMUNICATION MODULE TYPES
// ============================================

// Channel types
export type CommsChannelType = 
    | "MISSION" 
    | "CLIENT" 
    | "CAMPAIGN" 
    | "GROUP" 
    | "DIRECT" 
    | "BROADCAST";

// Thread status
export type CommsThreadStatus = "OPEN" | "RESOLVED" | "ARCHIVED";

// Message types
export type CommsMessageType = "TEXT" | "SYSTEM" | "BROADCAST";

// Labels for displaying in UI
export const CHANNEL_TYPE_LABELS: Record<CommsChannelType, string> = {
    MISSION: "Mission",
    CLIENT: "Client",
    CAMPAIGN: "Campagne",
    GROUP: "Groupe",
    DIRECT: "Direct",
    BROADCAST: "Annonce",
};

export const THREAD_STATUS_LABELS: Record<CommsThreadStatus, string> = {
    OPEN: "Ouvert",
    RESOLVED: "Résolu",
    ARCHIVED: "Archivé",
};

export const MESSAGE_TYPE_LABELS: Record<CommsMessageType, string> = {
    TEXT: "Message",
    SYSTEM: "Système",
    BROADCAST: "Annonce",
};

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

// Thread creation
export interface CreateThreadRequest {
    channelType: CommsChannelType;
    anchorId?: string;           // missionId, clientId, campaignId, or groupId
    participantIds?: string[];   // For DIRECT type, one or many recipients
    subject: string;
    initialMessage: string;
    isBroadcast?: boolean;
    broadcastAudience?: BroadcastAudience;
}

export interface BroadcastAudience {
    type: "all" | "role" | "mission" | "group";
    target?: string;  // roleId, missionId, or groupId
}

// Message creation
export interface CreateMessageRequest {
    threadId: string;
    content: string;
    mentionIds?: string[];
    attachmentIds?: string[];
    parentMessageId?: string;
}

// Thread update
export interface UpdateThreadRequest {
    status?: CommsThreadStatus;
    subject?: string;
}

// Message update
export interface UpdateMessageRequest {
    content: string;
}

// Group management
export interface CreateGroupRequest {
    name: string;
    description?: string;
    memberIds: string[];
}

export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}

export interface AddGroupMembersRequest {
    memberIds: string[];
}

// ============================================
// VIEW MODELS (for UI)
// ============================================

export interface CommsChannelView {
    id: string;
    type: CommsChannelType;
    name: string;
    anchorId?: string;
    anchorName?: string;
    threadCount: number;
    unreadCount: number;
}

export interface CommsThreadListItem {
    id: string;
    channelId: string;
    channelType: CommsChannelType;
    channelName: string;
    subject: string;
    status: CommsThreadStatus;
    isBroadcast: boolean;
    createdBy: {
        id: string;
        name: string;
    };
    /** For DIRECT threads: name of the other participant (so each user sees the other person, not themselves) */
    otherParticipantName?: string;
    participantCount: number;
    messageCount: number;
    unreadCount: number;
    lastMessage?: {
        content: string;
        authorName: string;
        createdAt: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface CommsThreadView extends CommsThreadListItem {
    participants: CommsParticipantView[];
    messages: CommsMessageView[];
}

export interface CommsParticipantView {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    lastReadAt?: string;
    unreadCount: number;
    isMuted: boolean;
    joinedAt: string;
}

export interface CommsMessageReadByView {
    userId: string;
    userName: string;
    readAt: string;
}

export interface CommsMessageReactionView {
    emoji: string;
    count: number;
    userIds: string[];
}

export interface CommsMessageView {
    id: string;
    threadId: string;
    type: CommsMessageType;
    content: string;
    parentMessageId?: string | null;
    parentPreview?: { authorName: string; content: string };
    author: {
        id: string;
        name: string;
        role: string;
        initials: string;
    };
    mentions: CommsMentionView[];
    attachments: CommsAttachmentView[];
    readBy?: CommsMessageReadByView[];
    reactions?: CommsMessageReactionView[];
    isEdited: boolean;
    isDeleted: boolean;
    isOwnMessage: boolean;
    createdAt: string;
    /** Present for optimistic (sending) messages; cleared when server confirms */
    isOptimistic?: boolean;
}

export interface CommsMentionView {
    userId: string;
    userName: string;
}

export interface CommsAttachmentView {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url?: string;
}

export interface CommsGroupView {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    members: {
        id: string;
        userId: string;
        userName: string;
        role: string;
    }[];
    createdBy: {
        id: string;
        name: string;
    };
    createdAt: string;
}

// ============================================
// INBOX VIEW MODELS
// ============================================

export interface CommsInboxStats {
    totalUnread: number;
    unreadByType: Record<CommsChannelType, number>;
    mentionCount: number;
}

export interface CommsInboxFilters {
    type?: CommsChannelType;
    status?: CommsThreadStatus;
    unreadOnly?: boolean;
    search?: string;
}

// ============================================
// NOTIFICATION PAYLOADS
// ============================================

export interface CommsNotificationPayload {
    type: "new_message" | "mention" | "thread_resolved" | "broadcast";
    threadId: string;
    threadSubject: string;
    channelType: CommsChannelType;
    channelName: string;
    messagePreview?: string;
    authorName?: string;
}
