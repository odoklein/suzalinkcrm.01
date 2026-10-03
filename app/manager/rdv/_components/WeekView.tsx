"use client";

import type { Meeting } from "../_types";
import { contactName, meetingStatus, statusBg, statusColor } from "../_lib/formatters";

interface WeekViewProps {
  calendarDate: Date;
  calendarMeetings: Map<string, Meeting[]>;
  openPanel: (m: Meeting) => void;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WeekView({ calendarDate, calendarMeetings, openPanel }: WeekViewProps) {
  const weekStart = new Date(calendarDate);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  return (
    <div style={{ display: "flex", gap: 0, overflow: "auto" }}>
      <div style={{ width: 56, flexShrink: 0 }}>
        <div style={{ height: 48 }} />
        {hours.map((h) => (
          <div key={h} style={{ height: 64, fontSize: 11, color: "var(--ink3)", textAlign: "right", paddingRight: 10, paddingTop: 2, fontWeight: 500 }}>
            {h}:00
          </div>
        ))}
      </div>
      {days.map((d) => {
        const key = toLocalDateKey(d);
        const dayMeetings = calendarMeetings.get(key) || [];
        const isToday = key === toLocalDateKey(new Date());
        return (
          <div key={key} style={{ flex: 1, minWidth: 110, borderLeft: "1px solid var(--border)" }}>
            <div style={{ height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--accent)" : "var(--ink2)" }}>
              {d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
            </div>
            <div style={{ position: "relative" }}>
              {hours.map((h) => (
                <div key={h} style={{ height: 64, borderTop: "1px solid var(--border)" }} />
              ))}
              {dayMeetings.map((m) => {
                if (!m.callbackDate) return null;
                const md = new Date(m.callbackDate);
                const hour = md.getHours();
                const min = md.getMinutes();
                if (hour < 8 || hour >= 20) return null;
                const top = (hour - 8) * 64 + Math.round((min * 64) / 60);
                return (
                  <div
                    key={m.id}
                    onClick={() => openPanel(m)}
                    style={{
                      position: "absolute", top, left: 3, right: 3, height: 56,
                      borderRadius: 8, background: statusBg(meetingStatus(m)),
                      borderLeft: `3px solid ${statusColor(meetingStatus(m))}`,
                      padding: "6px 8px", cursor: "pointer", overflow: "hidden", fontSize: 12, color: "var(--ink)",
                    }}
                  >
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {contactName(m.contact)}
                    </div>
                    <div style={{ color: "var(--ink3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
                      {m.company?.name || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
