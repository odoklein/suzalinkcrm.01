"use client";

import { useState, useRef, useCallback } from "react";

export type NoteStatus = "idle" | "saving" | "saved" | "error";

export interface UseNoteAutosaveReturn {
  managerNote: string;
  setManagerNote: (v: string) => void;
  noteStatus: NoteStatus;
  initNote: (note: string) => void;
  triggerSave: (
    meetingId: string,
    note: string,
    updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>
  ) => void;
}

export function useNoteAutosave(): UseNoteAutosaveReturn {
  const [managerNote, setManagerNote] = useState("");
  const [noteStatus, setNoteStatus] = useState<NoteStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initNote = useCallback((note: string) => {
    setManagerNote(note);
    setNoteStatus("idle");
  }, []);

  const triggerSave = useCallback(
    (
      meetingId: string,
      note: string,
      updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>
    ) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setNoteStatus("saving");
      timeoutRef.current = setTimeout(async () => {
        try {
          // Persist into the canonical note field so it reloads consistently.
          await updateMeeting(meetingId, { note });
          setNoteStatus("saved");
          setTimeout(() => setNoteStatus("idle"), 2000);
        } catch {
          setNoteStatus("error");
        }
      }, 1200);
    },
    []
  );

  return { managerNote, setManagerNote, noteStatus, initNote, triggerSave };
}
