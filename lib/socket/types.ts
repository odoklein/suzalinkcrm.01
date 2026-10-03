/**
 * Socket.IO comms event payload shapes (VPS server contract).
 * Align backend event names and payloads with these types.
 */

/** Payload when emitting user-online. Server expects userId. */
export interface UserOnlinePayload {
  userId: string;
}

/** Payload received on online-users. Server may send array of IDs or { userIds: string[] }. */
export type OnlineUsersPayload = string[] | { userIds: string[] };

/** Payload for typing event (emit and receive). */
export interface TypingPayload {
  userId: string;
  userName?: string;
  isTyping: boolean;
  recipientId?: string;
}

/** Payload received on receive-message. */
export interface ReceiveMessagePayload {
  messageId?: string;
  content: string;
  senderId: string;
  senderName?: string;
  createdAt?: string;
  threadId?: string;
}

/** Payload when emitting send-message. */
export interface SendMessagePayload {
  recipientUserId: string;
  message: string | Record<string, unknown>;
}
