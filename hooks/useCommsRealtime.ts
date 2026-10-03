"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { CommsRealtimePayload } from "@/lib/comms/events";
import {
  connectCommsSocket,
  disconnectCommsSocket,
  emitTyping as emitTypingSocket,
  getCommsSocketInstance,
} from "@/lib/socket/comms-socket";

export type CommsRealtimeHandler = (payload: CommsRealtimePayload) => void;

export interface UseCommsRealtimeOptions {
  enabled?: boolean;
  userId?: string;
  onEvent?: CommsRealtimeHandler;
  onPresenceChange?: (userId: string, isOnline: boolean) => void;
  /** Returns recipient user IDs for a thread (other participants). Used to emit typing per recipient. */
  getRecipientIdsForThread?: (threadId: string) => string[];
}

export interface UseCommsRealtimeResult {
  isConnected: boolean;
  lastEvent: CommsRealtimePayload | null;
  socket: ReturnType<typeof getCommsSocketInstance>;
  onlineUsers: Set<string>;
  joinThread: (threadId: string) => void;
  leaveThread: (threadId: string) => void;
  startTyping: (threadId: string, userName: string) => void;
  stopTyping: (threadId: string, userName: string) => void;
}

const EMPTY_SET = new Set<string>();

/**
 * Comms realtime hook: connects to the VPS Socket.IO server, emits user-online,
 * listens for online-users / typing / receive-message, and exposes startTyping/stopTyping
 * that emit typing per recipient (using getRecipientIdsForThread).
 */
export function useCommsRealtime(
  options: UseCommsRealtimeOptions = {}
): UseCommsRealtimeResult {
  const {
    enabled = false,
    userId,
    onEvent,
    onPresenceChange,
    getRecipientIdsForThread,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(EMPTY_SET);
  const [lastEvent, setLastEvent] = useState<CommsRealtimePayload | null>(null);

  const onEventRef = useRef(onEvent);
  const onPresenceChangeRef = useRef(onPresenceChange);
  const getRecipientIdsRef = useRef(getRecipientIdsForThread);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onEventRef.current = onEvent;
  onPresenceChangeRef.current = onPresenceChange;
  getRecipientIdsRef.current = getRecipientIdsForThread;

  useEffect(() => {
    if (!enabled || !userId) {
      disconnectCommsSocket();
      setIsConnected(false);
      setOnlineUsers(EMPTY_SET);
      return;
    }

    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    connectCommsSocket(userId, {
      onOnlineUsers: (userIds) => {
        setOnlineUsers(userIds);
      },
      onTyping: (payload) => {
        const type = payload.isTyping ? "typing_start" : "typing_stop";
        const event: CommsRealtimePayload = {
          type,
          threadId: "",
          userId: payload.userId,
          userName: payload.userName ?? "Utilisateur",
        };
        setLastEvent(event);
        onEventRef.current?.(event);
      },
      onReceiveMessage: (payload) => {
        const event: CommsRealtimePayload = {
          type: "message_created",
          threadId: payload.threadId ?? "",
          userId: payload.senderId,
          userName: payload.senderName,
          messageId: payload.messageId,
          content: payload.content,
          createdAt: payload.createdAt ?? new Date().toISOString(),
        };
        setLastEvent(event);
        onEventRef.current?.(event);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
    });

    const socket = getCommsSocketInstance();
    if (socket) {
      const onConnect = () => setIsConnected(true);
      socket.on("connect", onConnect);
      if (socket.connected) setIsConnected(true);
      return () => {
        socket.off("connect", onConnect);
        disconnectTimerRef.current = setTimeout(() => {
          disconnectCommsSocket();
          disconnectTimerRef.current = null;
        }, 150);
      };
    }

    return () => {
      disconnectTimerRef.current = setTimeout(() => {
        disconnectCommsSocket();
        disconnectTimerRef.current = null;
      }, 150);
    };
  }, [enabled, userId]);

  const joinThread = useCallback((_threadId: string) => {
    // No-op unless VPS supports rooms per thread
  }, []);

  const leaveThread = useCallback((_threadId: string) => {
    // No-op unless VPS supports rooms per thread
  }, []);

  const startTyping = useCallback((threadId: string, _userName: string) => {
    const recipientIds = getRecipientIdsRef.current?.(threadId) ?? [];
    recipientIds.forEach((recipientId) => {
      emitTypingSocket(recipientId, true);
    });
  }, []);

  const stopTyping = useCallback((threadId: string, _userName: string) => {
    const recipientIds = getRecipientIdsRef.current?.(threadId) ?? [];
    recipientIds.forEach((recipientId) => {
      emitTypingSocket(recipientId, false);
    });
  }, []);

  return {
    isConnected,
    lastEvent,
    socket: getCommsSocketInstance(),
    onlineUsers,
    joinThread,
    leaveThread,
    startTyping,
    stopTyping,
  };
}
