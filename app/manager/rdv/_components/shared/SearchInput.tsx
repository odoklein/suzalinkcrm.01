"use client";

import { memo, useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";

export const SearchInput = memo(function SearchInput({
  initialSearch,
  onDebouncedSearch,
}: {
  initialSearch: string;
  onDebouncedSearch: (v: string) => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => onDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search, onDebouncedSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 520 }}>
        <Search
          size={16}
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink3)",
          }}
        />
        <input
          ref={searchRef}
          className="rdv-input"
          style={{
            width: "100%",
            paddingLeft: 40,
            paddingRight: 64,
            background: "var(--surface2)",
            borderColor: "transparent",
          }}
          placeholder="Rechercher un contact, entreprise, SDR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 11,
            color: "var(--ink3)",
            fontFamily: "inherit",
          }}
        >
          ⌘K
        </kbd>
      </div>
    </div>
  );
});
