"use client";

import { useState, useCallback } from "react";
import type { Meeting, PanelTab } from "../_types";

export interface DetailFormState {
  callbackDate: string;
  meetingType: string;
  meetingAddress: string;
  meetingJoinUrl: string;
  meetingPhone: string;
}

export interface UseDetailPanelReturn {
  selectedMeeting: Meeting | null;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  panelOpen: boolean;
  panelTab: PanelTab;
  setPanelTab: (t: PanelTab) => void;
  openPanel: (m: Meeting, allMeetings: Meeting[]) => void;
  closePanel: () => void;
  detailEditMode: boolean;
  setDetailEditMode: (v: boolean) => void;
  detailForm: DetailFormState;
  setDetailForm: React.Dispatch<React.SetStateAction<DetailFormState>>;
  detailSaving: boolean;
  setDetailSaving: (v: boolean) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  toggleSelectAll: (allMeetings: Meeting[]) => void;
  clearSelection: () => void;
}

export function useDetailPanel(): UseDetailPanelReturn {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("detail");
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<DetailFormState>({
    callbackDate: "",
    meetingType: "",
    meetingAddress: "",
    meetingJoinUrl: "",
    meetingPhone: "",
  });
  const [detailSaving, setDetailSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const openPanel = useCallback((m: Meeting, allMeetings: Meeting[]) => {
    const resolved = allMeetings.find((x) => x.id === m.id) ?? m;
    setSelectedMeeting(resolved);
    setPanelTab("detail");
    setPanelOpen(true);
    setDetailEditMode(false);
    setDetailForm({
      callbackDate: resolved.callbackDate
        ? new Date(resolved.callbackDate).toISOString().slice(0, 16)
        : "",
      meetingType: resolved.meetingType || "",
      meetingAddress: resolved.meetingAddress || "",
      meetingJoinUrl: resolved.meetingJoinUrl || "",
      meetingPhone: resolved.meetingPhone || "",
    });
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((allMeetings: Meeting[]) => {
    setSelectedIds((prev) => {
      if (prev.size === allMeetings.length) return new Set();
      return new Set(allMeetings.map((m) => m.id));
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedMeeting,
    setSelectedMeeting,
    panelOpen,
    panelTab,
    setPanelTab,
    openPanel,
    closePanel,
    detailEditMode,
    setDetailEditMode,
    detailForm,
    setDetailForm,
    detailSaving,
    setDetailSaving,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  };
}
