"use client";

export function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "100px 32px",
        color: "var(--ink3)",
      }}
    >
      <svg
        width="140"
        height="110"
        viewBox="0 0 140 110"
        fill="none"
        style={{ marginBottom: 28, opacity: 0.5 }}
      >
        <rect
          x="15"
          y="22"
          width="110"
          height="78"
          rx="14"
          stroke="var(--border2)"
          strokeWidth="2"
          fill="var(--surface2)"
        />
        <rect x="30" y="40" width="80" height="7" rx="3.5" fill="var(--border2)" />
        <rect x="30" y="54" width="55" height="7" rx="3.5" fill="var(--border)" />
        <rect x="30" y="68" width="65" height="7" rx="3.5" fill="var(--border)" />
        <circle
          cx="70"
          cy="16"
          r="12"
          stroke="var(--accent)"
          strokeWidth="2"
          fill="var(--accentLight)"
        />
        <path
          d="M65 16l4 4 6-6"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--ink2)",
          marginBottom: 10,
        }}
      >
        Aucun rendez-vous trouvé
      </div>
      <div
        style={{
          fontSize: 14,
          textAlign: "center",
          maxWidth: 340,
          lineHeight: 1.5,
        }}
      >
        Ajustez vos filtres ou la période sélectionnée pour afficher des résultats.
      </div>
    </div>
  );
}
