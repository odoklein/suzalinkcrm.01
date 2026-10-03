"use client";

import { X } from "lucide-react";

export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: "var(--accentLight)",
        color: "var(--accent)",
        borderRadius: 8,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent)",
          cursor: "pointer",
          padding: 0,
          display: "flex",
        }}
      >
        <X size={12} />
      </button>
    </span>
  );
}
