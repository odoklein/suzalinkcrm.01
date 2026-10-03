"use client";

import { useMemo, useState } from "react";
import type { Meeting } from "../../_types";
import { AlertTriangle, Trash2 } from "lucide-react";

interface DeleteRdvConfirmDialogProps {
  isOpen: boolean;
  selectedMeetings: Meeting[];
  deleting?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

function meetingLabel(meeting: Meeting) {
  const contact = [meeting.contact?.firstName, meeting.contact?.lastName].filter(Boolean).join(" ");
  const primary = contact || meeting.company?.name || "Meeting sans contact";
  return `${primary} - ${meeting.company?.name || "Sans entreprise"}`;
}

export function DeleteRdvConfirmDialog({
  isOpen,
  selectedMeetings,
  deleting = false,
  onClose,
  onConfirm,
}: DeleteRdvConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const selectedCount = selectedMeetings.length;
  const requiresGuard = selectedCount > 5;
  const guardToken = useMemo(() => `DELETE ${selectedCount}`, [selectedCount]);
  const deleteAllowed = !requiresGuard || confirmInput.trim().toUpperCase() === guardToken;

  if (!isOpen) return null;

  const close = () => {
    setConfirmInput("");
    onClose();
  };

  const confirm = async () => {
    await onConfirm();
    setConfirmInput("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={close}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: 28,
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--redLight)",
              display: "grid",
              placeContent: "center",
            }}
          >
            <AlertTriangle size={20} style={{ color: "var(--red)" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
              Confirmer la suppression
            </div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>
              Cette action est irreversible.
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: "var(--ink2)", marginBottom: 24, lineHeight: 1.5 }}>
          Vous allez supprimer <strong>{selectedCount}</strong> rendez-vous selectionne
          {selectedCount > 1 ? "s" : ""}. Cette action ne peut pas etre annulee.
        </p>

        <div
          className="rdv-scrollbar"
          style={{
            maxHeight: 140,
            overflowY: "auto",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface2)",
            padding: "8px 10px",
            marginBottom: 14,
          }}
        >
          {selectedMeetings.slice(0, 20).map((meeting) => (
            <div key={meeting.id} style={{ fontSize: 12, color: "var(--ink2)", padding: "4px 0" }}>
              {meetingLabel(meeting)}
            </div>
          ))}
          {selectedMeetings.length > 20 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", paddingTop: 4 }}>
              +{selectedMeetings.length - 20} autres
            </div>
          )}
        </div>

        {requiresGuard && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 6 }}>
              Tapez <strong>{guardToken}</strong> pour confirmer.
            </div>
            <input
              className="rdv-input"
              value={confirmInput}
              onChange={(event) => setConfirmInput(event.target.value)}
              placeholder={guardToken}
              autoFocus
            />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="rdv-btn rdv-btn-ghost" onClick={close}>
            Annuler
          </button>
          <button
            className="rdv-btn"
            style={{ background: "var(--red)", color: "white" }}
            onClick={confirm}
            disabled={!deleteAllowed || deleting}
          >
            <Trash2 size={13} /> {deleting ? "Suppression..." : "Supprimer definitivement"}
          </button>
        </div>
      </div>
    </div>
  );
}
