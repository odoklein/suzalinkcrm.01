import type { Meeting } from "../_types";
import { meetingStatus, statusLabel, categoryLabel, contactName, meetingTypeLabel, outcomeLabel } from "./formatters";

export function downloadCSV(meetings: Meeting[], filters: string) {
  const BOM = "\uFEFF";
  const headers = [
    "Date", "Heure", "Statut", "Catégorie", "Client", "Mission", "Campagne",
    "Contact", "Poste", "Email", "Téléphone", "LinkedIn", "Entreprise",
    "Secteur", "Pays", "Taille", "SDR", "Type RDV", "Feedback",
    "Recontact", "Note SDR",
  ];
  const rows = meetings.map((m) => {
    const d = m.callbackDate ? new Date(m.callbackDate) : null;
    return [
      d ? d.toLocaleDateString("fr-FR") : "",
      d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
      statusLabel(meetingStatus(m)),
      categoryLabel(m.meetingCategory) || "",
      m.client?.name || "",
      m.mission.name,
      m.campaign.name,
      contactName(m.contact),
      m.contact?.title || "",
      m.contact?.email || "",
      m.contact?.phone || "",
      m.contact?.linkedin || "",
      m.company?.name || "",
      m.company?.industry || "",
      m.company?.country || "",
      m.company?.size || "",
      m.sdr.name,
      meetingTypeLabel(m.meetingType),
      m.feedback ? outcomeLabel(m.feedback.outcome) : "",
      m.feedback?.recontact || "",
      m.note || "",
    ];
  });
  const csv =
    BOM +
    [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `rdv_export_${dateStr}${filters ? "_" + filters : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
