// ============================================
// COMMS REAL-TIME HELPERS
// REPLACED: In-memory EventEmitter pub/sub → no-ops
// Reason: Comms uses Socket.IO (VPS server), VoIP uses polling.
// The in-memory EventEmitter was never consumed (serverless = no shared state).
// ============================================

/**
 * No-op: Real-time message delivery handled by Socket.IO (see useCommsRealtime).
 * Previously pushed to in-memory EventEmitter (broken on serverless).
 */
export async function publishMessageCreated(
    _threadId: string,
    _messageId: string,
    _authorId: string,
    _authorName: string,
    _content: string,
    _createdAt: string
): Promise<void> {
    // No-op: Socket.IO handles real-time delivery
}

/**
 * No-op: Real-time message updates handled by Socket.IO.
 */
export async function publishMessageUpdated(
    _threadId: string,
    _messageId: string,
    _content: string
): Promise<void> {
    // No-op: Socket.IO handles real-time delivery
}

/**
 * No-op: Real-time message deletion handled by Socket.IO.
 */
export async function publishMessageDeleted(
    _threadId: string,
    _messageId: string
): Promise<void> {
    // No-op: Socket.IO handles real-time delivery
}

/**
 * No-op: Real-time thread status updates handled by Socket.IO.
 */
export async function publishThreadStatusUpdated(
    _threadId: string,
    _status: string
): Promise<void> {
    // No-op: Socket.IO handles real-time delivery
}

/**
 * No-op: Typing indicators handled by Socket.IO (see useCommsRealtime.startTyping).
 */
export async function publishTyping(
    _threadId: string,
    _typistUserId: string,
    _typistUserName: string,
    _isTyping: boolean
): Promise<void> {
    // No-op: Socket.IO handles typing indicators
}
