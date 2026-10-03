"use client";

import { useState, useCallback } from "react";
import type { Meeting } from "../_types";

export interface UseFeedbackReturn {
  feedbackOutcome: string | null;
  setFeedbackOutcome: (v: string | null) => void;
  feedbackRecontact: string | null;
  setFeedbackRecontact: (v: string | null) => void;
  feedbackNote: string;
  setFeedbackNote: (v: string) => void;
  initFeedback: (m: Meeting) => void;
  saveFeedback: (
    meeting: Meeting,
    updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>
  ) => void;
}

export function useFeedback(): UseFeedbackReturn {
  const [feedbackOutcome, setFeedbackOutcome] = useState<string | null>(null);
  const [feedbackRecontact, setFeedbackRecontact] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");

  const initFeedback = useCallback((m: Meeting) => {
    if (m.feedback) {
      setFeedbackOutcome(m.feedback.outcome);
      setFeedbackRecontact(m.feedback.recontact);
      setFeedbackNote(m.feedback.note || "");
    } else {
      setFeedbackOutcome(null);
      setFeedbackRecontact(null);
      setFeedbackNote("");
    }
  }, []);

  const saveFeedback = useCallback(
    (
      meeting: Meeting,
      updateMeeting: (id: string, data: Record<string, unknown>) => Promise<void>
    ) => {
      if (meeting && feedbackOutcome) {
        updateMeeting(meeting.id, {
          feedbackOutcome,
          feedbackRecontact: feedbackRecontact || "NO",
          feedbackNote,
        });
      }
    },
    [feedbackOutcome, feedbackRecontact, feedbackNote]
  );

  return {
    feedbackOutcome,
    setFeedbackOutcome,
    feedbackRecontact,
    setFeedbackRecontact,
    feedbackNote,
    setFeedbackNote,
    initFeedback,
    saveFeedback,
  };
}
