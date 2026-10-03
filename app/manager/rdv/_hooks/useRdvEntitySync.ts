"use client";

import { useCallback } from "react";
import type { LinkContactResult, Meeting } from "../_types";

interface UseRdvEntitySyncParams {
  selectedMeeting: Meeting | null;
  setSelectedMeeting: React.Dispatch<React.SetStateAction<Meeting | null>>;
  updateLocalMeeting: (id: string, patch: Partial<Meeting>) => void;
  updateLocalMeetings: (updater: (prev: Meeting[]) => Meeting[]) => void;
}

export type ContactPatch = {
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
};

export type CompanyPatch = {
  name: string;
  industry: string | null;
  country: string | null;
  size: string | null;
  website: string | null;
  phone: string | null;
};

export function useRdvEntitySync({
  selectedMeeting,
  setSelectedMeeting,
  updateLocalMeeting,
  updateLocalMeetings,
}: UseRdvEntitySyncParams) {
  const handleContactSaved = useCallback(
    (patch: ContactPatch) => {
      if (!selectedMeeting?.contact) return;

      setSelectedMeeting((prev) =>
        prev?.contact ? { ...prev, contact: { ...prev.contact, ...patch } } : prev,
      );

      updateLocalMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === selectedMeeting.id && meeting.contact
            ? { ...meeting, contact: { ...meeting.contact, ...patch } }
            : meeting,
        ),
      );
    },
    [selectedMeeting, setSelectedMeeting, updateLocalMeetings],
  );

  const handleCompanySaved = useCallback(
    (patch: CompanyPatch) => {
      if (!selectedMeeting?.company) return;

      setSelectedMeeting((prev) =>
        prev?.company ? { ...prev, company: { ...prev.company, ...patch } } : prev,
      );

      updateLocalMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === selectedMeeting.id && meeting.company
            ? { ...meeting, company: { ...meeting.company, ...patch } }
            : meeting,
        ),
      );
    },
    [selectedMeeting, setSelectedMeeting, updateLocalMeetings],
  );

  const handleContactLinked = useCallback(
    (contact: LinkContactResult) => {
      const contactPatch = {
        id: contact.id,
        firstName: contact.firstName ?? null,
        lastName: contact.lastName ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        title: contact.title ?? null,
        linkedin: null,
        customData: null,
      };
      const companyData = contact.company
        ? {
            id: contact.company.id,
            name: contact.company.name,
            industry: null,
            country: null,
            size: null,
            website: null,
            phone: null,
          }
        : null;

      setSelectedMeeting((prev) =>
        prev ? { ...prev, contact: contactPatch, company: companyData } : null,
      );

      if (!selectedMeeting?.id) return;

      updateLocalMeeting(selectedMeeting.id, { contact: contactPatch, company: companyData });
    },
    [selectedMeeting, setSelectedMeeting, updateLocalMeeting],
  );

  return {
    handleContactSaved,
    handleCompanySaved,
    handleContactLinked,
  };
}
