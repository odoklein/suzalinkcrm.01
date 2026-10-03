"use client";

import type { Meeting } from "../_types";
import { downloadCSV } from "../_lib/csv-export";
import { Check, Download, Trash2, X, XCircle } from "lucide-react";

interface RdvBulkActionsProps {
  selectedMeetings: Meeting[];
  confirming: boolean;
  cancelling: boolean;
  onConfirm: () => void;
  onCancelMeetings: () => void;
  onDeleteRequest: () => void;
  onClearSelection: () => void;
}

export function RdvBulkActions({
  selectedMeetings,
  confirming,
  cancelling,
  onConfirm,
  onCancelMeetings,
  onDeleteRequest,
  onClearSelection,
}: RdvBulkActionsProps) {
  if (selectedMeetings.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: 16,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        zIndex: 40,
        animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
      }}
      className="bulk-action-bar"
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
        {selectedMeetings.length} selectionne{selectedMeetings.length > 1 ? "s" : ""}
      </span>
      <div style={{ width: 1, height: 24, background: "var(--border2)" }} />
      <button
        className="rdv-btn"
        style={{
          fontSize: 12,
          background: "var(--greenLight)",
          color: "var(--green)",
          border: "1px solid rgba(5,150,105,0.2)",
        }}
        onClick={onConfirm}
        disabled={confirming}
      >
        <Check size={13} /> {confirming ? "Confirmation..." : "Confirmer"}
      </button>
      <button
        className="rdv-btn"
        style={{
          fontSize: 12,
          background: "var(--amberLight)",
          color: "var(--amber)",
          border: "1px solid rgba(217,119,6,0.2)",
        }}
        onClick={onCancelMeetings}
        disabled={cancelling}
      >
        <XCircle size={13} /> {cancelling ? "Annulation..." : "Annuler"}
      </button>
      <button
        className="rdv-btn rdv-btn-ghost"
        style={{ fontSize: 12 }}
        onClick={() => downloadCSV(selectedMeetings, "selection")}
      >
        <Download size={13} /> Exporter CSV
      </button>
      <button
        className="rdv-btn"
        style={{
          fontSize: 12,
          background: "var(--redLight)",
          color: "var(--red)",
          border: "1px solid rgba(220,38,38,0.2)",
        }}
        onClick={onDeleteRequest}
      >
        <Trash2 size={13} /> Supprimer
      </button>
      <button
        style={{
          background: "var(--surface2)",
          border: "none",
          color: "var(--ink3)",
          cursor: "pointer",
          padding: 6,
          borderRadius: 8,
        }}
        onClick={onClearSelection}
      >
        <X size={14} />
      </button>
    </div>
  );
}
