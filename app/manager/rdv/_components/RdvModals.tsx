"use client";

import type { LinkContactResult, Meeting } from "../_types";
import type { CompanyPatch, ContactPatch } from "../_hooks/useRdvEntitySync";
import { EditContactModal } from "./modals/EditContactModal";
import { EditCompanyModal } from "./modals/EditCompanyModal";
import { LinkContactModal } from "./modals/LinkContactModal";
import { SyncRdvAudiosModal } from "./modals/SyncRdvAudiosModal";

export type RdvModalType = "editContact" | "editCompany" | "linkContact" | null;

interface RdvModalsProps {
  activeModal: RdvModalType;
  selectedMeeting: Meeting | null;
  meetings: Meeting[];
  selectedIds: Set<string>;
  syncAudiosOpen: boolean;
  onCloseActiveModal: () => void;
  onCloseSyncAudios: () => void;
  onContactSaved: (patch: ContactPatch) => void;
  onCompanySaved: (patch: CompanyPatch) => void;
  onContactLinked: (contact: LinkContactResult) => void;
  onAudiosSynced: () => Promise<void>;
}

export function RdvModals({
  activeModal,
  selectedMeeting,
  meetings,
  selectedIds,
  syncAudiosOpen,
  onCloseActiveModal,
  onCloseSyncAudios,
  onContactSaved,
  onCompanySaved,
  onContactLinked,
  onAudiosSynced,
}: RdvModalsProps) {
  return (
    <>
      {activeModal === "editContact" && selectedMeeting?.contact && (
        <EditContactModal
          meeting={selectedMeeting}
          onClose={onCloseActiveModal}
          onSaved={onContactSaved}
        />
      )}
      {activeModal === "editCompany" && selectedMeeting?.company && (
        <EditCompanyModal
          meeting={selectedMeeting}
          onClose={onCloseActiveModal}
          onSaved={onCompanySaved}
        />
      )}
      {activeModal === "linkContact" && selectedMeeting && (
        <LinkContactModal
          meeting={selectedMeeting}
          onClose={onCloseActiveModal}
          onLinked={onContactLinked}
        />
      )}
      <SyncRdvAudiosModal
        isOpen={syncAudiosOpen}
        onClose={onCloseSyncAudios}
        meetings={meetings}
        selectedIds={selectedIds}
        onSynced={onAudiosSynced}
      />
    </>
  );
}
