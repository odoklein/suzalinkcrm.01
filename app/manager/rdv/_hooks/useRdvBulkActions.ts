"use client";

import { useCallback, useState } from "react";
import type { Meeting } from "../_types";

interface UseRdvBulkActionsParams {
  selectedIds: Set<string>;
  clearSelection: () => void;
  updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>;
  bulkUpdateMeetings?: (ids: string[], data: Record<string, unknown>) => Promise<void>;
  deleteMeetings: (ids: string[]) => Promise<void>;
  updateLocalMeeting: (id: string, patch: Partial<Meeting>) => void;
}

export function useRdvBulkActions({
  selectedIds,
  clearSelection,
  updateMeeting,
  bulkUpdateMeetings,
  deleteMeetings,
  updateLocalMeeting,
}: UseRdvBulkActionsParams) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmSelected = useCallback(async () => {
    setConfirming(true);
    try {
      const ids = Array.from(selectedIds);
      const confirmedAt = new Date().toISOString();

      ids.forEach((id) => {
        updateLocalMeeting(id, { confirmationStatus: "CONFIRMED", confirmedAt });
      });

      if (bulkUpdateMeetings) {
        await bulkUpdateMeetings(ids, { confirmationStatus: "CONFIRMED" });
      } else {
        await Promise.all(ids.map((id) => updateMeeting(id, { confirmationStatus: "CONFIRMED" })));
      }
      clearSelection();
    } finally {
      setConfirming(false);
    }
  }, [bulkUpdateMeetings, clearSelection, selectedIds, updateLocalMeeting, updateMeeting]);

  const cancelSelected = useCallback(async () => {
    setCancelling(true);
    try {
      const ids = Array.from(selectedIds);

      ids.forEach((id) => {
        updateLocalMeeting(id, {
          confirmationStatus: "CANCELLED",
          confirmedAt: null,
          confirmedById: null,
        });
      });

      if (bulkUpdateMeetings) {
        await bulkUpdateMeetings(ids, { confirmationStatus: "CANCELLED" });
      } else {
        await Promise.all(ids.map((id) => updateMeeting(id, { confirmationStatus: "CANCELLED" })));
      }
      clearSelection();
    } finally {
      setCancelling(false);
    }
  }, [bulkUpdateMeetings, clearSelection, selectedIds, updateLocalMeeting, updateMeeting]);

  const deleteSelected = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteMeetings(Array.from(selectedIds));
      clearSelection();
    } finally {
      setDeleting(false);
    }
  }, [clearSelection, deleteMeetings, selectedIds]);

  return {
    confirming,
    cancelling,
    deleting,
    confirmSelected,
    cancelSelected,
    deleteSelected,
  };
}
