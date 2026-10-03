"use client";

import { useCallback, useEffect, useRef } from "react";

export interface UseMeetingActionsReturn {
  updateMeeting: (
    id: string,
    data: Record<string, unknown>,
    options?: { refresh?: boolean },
  ) => Promise<void>;
  bulkUpdateMeetings: (ids: string[], data: Record<string, unknown>) => Promise<void>;
  deleteMeetings: (ids: string[]) => Promise<void>;
}

export function useMeetingActions(
  onSuccess: () => void
): UseMeetingActionsReturn {
  const onSuccessRef = useRef(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const updateMeeting = useCallback(
    async (id: string, data: Record<string, unknown>, options: { refresh?: boolean } = {}) => {
      try {
        const res = await fetch(`/api/manager/rdv/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok && options.refresh !== false) onSuccessRef.current();
      } catch (e) {
        console.error("Update failed:", e);
      }
    },
    []
  );

  const bulkUpdateMeetings = useCallback(async (ids: string[], data: Record<string, unknown>) => {
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/manager/rdv/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        })
      )
    );
    onSuccessRef.current();
  }, []);

  const deleteMeetings = useCallback(async (ids: string[]) => {
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/manager/rdv/${id}`, { method: "DELETE" })
      )
    );
    onSuccessRef.current();
  }, []);

  return { updateMeeting, bulkUpdateMeetings, deleteMeetings };
}
