/**
 * Singleton Socket.IO client for CRM comms (VPS at 173.212.231.174, port 4000).
 * Connects over WebSocket only. Set NEXT_PUBLIC_SOCKET_URL to override (e.g. for production behind a domain).
 * When the app is served over HTTPS (e.g. Vercel), the socket URL is forced to HTTPS so the browser uses wss://
 * and does not block mixed content. For production, use a URL with valid TLS (e.g. https://suzalink.com).
 */

import { io, type Socket } from "socket.io-client";
import type {
  OnlineUsersPayload,
  TypingPayload,
  ReceiveMessagePayload,
} from "./types";

const DEFAULT_URL =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SOCKET_URL
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : "http://173.212.231.174:4000";
/** Socket.IO server default path is /socket.io. Override with NEXT_PUBLIC_SOCKET_PATH if your server uses a different path (e.g. /socket). */
const DEFAULT_PATH =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SOCKET_PATH
    ? process.env.NEXT_PUBLIC_SOCKET_PATH
    : "/socket.io";

/** Use HTTPS when the page is HTTPS to avoid mixed-content blocking (HTTPS page → ws://). */
function getEffectiveUrl(url: string): string {
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    url.startsWith("http://")
  ) {
    return url.replace(/^http:\/\//, "https://");
  }
  return url;
}

export interface CommsSocketCallbacks {
  /** Called when the server sends the list of online user IDs. */
  onOnlineUsers?: (userIds: Set<string>) => void;
  /** Called when a typing event is received (userId, userName, isTyping). */
  onTyping?: (payload: TypingPayload) => void;
  /** Called when a receive-message event is received (for CRM message_created). */
  onReceiveMessage?: (payload: ReceiveMessagePayload) => void;
  /** Called on disconnect or connect_error so the hook can set isConnected false. */
  onDisconnect?: () => void;
}

let socket: Socket | null = null;

/**
 * Returns the singleton Socket instance (lazy-created). Does not connect.
 * Use connectCommsSocket() to connect and register callbacks.
 */
function getSocket(options: { url?: string; path?: string } = {}): Socket {
  const url = getEffectiveUrl(options.url ?? DEFAULT_URL);
  const path = options.path ?? DEFAULT_PATH;
  if (!socket) {
    socket = io(url, {
      path,
      transports: ["websocket"],
      autoConnect: false,
    });
  }
  return socket;
}

/**
 * Connect to the VPS Socket.IO server and register callbacks.
 * On successful connect, emits user-online with the given userId.
 * Call disconnectCommsSocket() on unmount or when comms is disabled.
 */
export function connectCommsSocket(
  userId: string,
  callbacks: CommsSocketCallbacks,
  options: { url?: string; path?: string } = {}
): Socket {
  const s = getSocket(options);
  s.removeAllListeners();

  const onConnect = (): void => {
    s.emit("user-online", { userId });
  };

  const onOnlineUsers = (payload: OnlineUsersPayload): void => {
    const ids = Array.isArray(payload)
      ? payload
      : (payload as { userIds?: string[] }).userIds ?? [];
    const set = new Set<string>(ids);
    callbacks.onOnlineUsers?.(set);
  };

  const onTyping = (payload: TypingPayload): void => {
    callbacks.onTyping?.(payload);
  };

  const onReceiveMessage = (payload: ReceiveMessagePayload): void => {
    callbacks.onReceiveMessage?.(payload);
  };

  const onDisconnect = (): void => {
    callbacks.onDisconnect?.();
  };

  s.on("connect", onConnect);
  s.on("online-users", onOnlineUsers);
  s.on("typing", onTyping);
  s.on("receive-message", onReceiveMessage);
  s.on("disconnect", onDisconnect);
  s.on("connect_error", onDisconnect);

  if (!s.connected) {
    s.connect();
  } else {
    onConnect();
  }

  return s;
}

/**
 * Disconnect the singleton socket and clear listeners. Call when leaving comms or unmounting.
 */
export function disconnectCommsSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

/**
 * Emit typing status to the server for a specific recipient.
 * Server is expected to forward to that user.
 */
export function emitTyping(
  recipientUserId: string,
  isTyping: boolean,
  options: { url?: string; path?: string } = {}
): void {
  const s = getSocket(options);
  if (s.connected) {
    s.emit("typing", {
      recipientId: recipientUserId,
      isTyping,
    });
  }
}

/**
 * Emit send-message for real-time delivery to a recipient.
 * Persistence should still be done via REST (POST /api/comms/threads/:id/messages).
 */
export function emitSendMessage(
  recipientUserId: string,
  message: string | Record<string, unknown>,
  options: { url?: string; path?: string } = {}
): void {
  const s = getSocket(options);
  if (s.connected) {
    s.emit("send-message", {
      recipientUserId,
      message: typeof message === "string" ? { content: message } : message,
    });
  }
}

/**
 * Get the current socket instance (for hook compatibility). May be null if never connected.
 */
export function getCommsSocketInstance(): Socket | null {
  return socket;
}
