// ============================================
// COMMS REAL-TIME EVENT TYPES & IN-MEMORY PUB/SUB
// ============================================

import { EventEmitter } from "events";

export type CommsRealtimeEventType =
    | "message_created"
    | "message_updated"
    | "message_deleted"
    | "thread_status_updated"
    | "thread_updated"
    | "typing_start"
    | "typing_stop"
    | "presence_online"
    | "presence_offline";

export interface CommsRealtimePayload {
    type: CommsRealtimeEventType;
    threadId: string;
    userId?: string;
    userName?: string;
    messageId?: string;
    content?: string;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
}

const CHANNEL_PREFIX = "comms:user:";
const emitter = new EventEmitter();
emitter.setMaxListeners(500);

function userChannel(userId: string): string {
    return `${CHANNEL_PREFIX}${userId}`;
}

/**
 * Publish an event to a user's channel (they receive it via SSE).
 */
export function publishToUser(userId: string, payload: CommsRealtimePayload): void {
    const ch = userChannel(userId);
    emitter.emit(ch, payload);
}

/**
 * Subscribe to events for a user. Returns an unsubscribe function.
 */
export function subscribeToUser(
    userId: string,
    onEvent: (payload: CommsRealtimePayload) => void
): () => void {
    const ch = userChannel(userId);
    emitter.on(ch, onEvent);
    return () => {
        emitter.off(ch, onEvent);
    };
}

/**
 * Internal: subscribe for typing broadcast (used by realtime layer to fan out to users).
 */
export function subscribeTypingBroadcast(
    handler: (data: {
        threadId: string;
        typistUserId: string;
        typistUserName: string;
        isTyping: boolean;
    }) => void
): () => void {
    emitter.on("comms:typing:broadcast", handler);
    return () => emitter.off("comms:typing:broadcast", handler);
}

/**
 * Emit typing broadcast. Realtime layer subscribes and fans out to thread participants.
 */
export function emitTypingBroadcast(
    threadId: string,
    typistUserId: string,
    typistUserName: string,
    isTyping: boolean
): void {
    emitter.emit("comms:typing:broadcast", {
        threadId,
        typistUserId,
        typistUserName,
        isTyping,
    });
}
