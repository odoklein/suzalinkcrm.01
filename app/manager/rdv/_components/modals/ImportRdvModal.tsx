"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";

interface RdvImportMappings {
  dateColumn: string;
  contactEmailColumn?: string;
  companyNameColumn?: string;
  meetingTypeColumn?: string;
  meetingCategoryColumn?: string;
  noteColumn?: string;
  meetingAddressColumn?: string;
  meetingJoinUrlColumn?: string;
  meetingPhoneColumn?: string;
}

interface Mission {
  id: string;
  name: string;
  lists: { id: string; name: string }[];
}

type MissingEntityHandling = "skip" | "create_company" | "create_contact_and_company";

interface ImportRdvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(firstLine: string): string {
  const delimiters = [",", ";", "\t", "|"];
  let maxCount = 0;
  let detected = ",";
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(`\\${d}`, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detected = d;
    }
  }
  return detected;
}

export function ImportRdvModal({ isOpen, onClose, onSuccess }: ImportRdvModalProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionId, setMissionId] = useState("");
  const [listId, setListId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mappings, setMappings] = useState<RdvImportMappings>({ dateColumn: "" });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [missingEntityHandling, setMissingEntityHandling] = useState<MissingEntityHandling>("skip");
  const [showCampaignQuickCreate, setShowCampaignQuickCreate] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [showListQuickCreate, setShowListQuickCreate] = useState(false);
  const [listName, setListName] = useState("");
  const [result, setResult] = useState<{
    created: number;
    totalRows: number;
    errors: { row: number; message: string }[];
    skippedInvalidDate?: number;
    skippedMissingEntity?: number;
    createdCompanies?: number;
    createdContacts?: number;
  } | null>(null);

  const fetchMissions = useCallback(async () => {
    const res = await fetch("/api/missions?limit=200");
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      setMissions(json.data as Mission[]);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMissions();
      setStep(1);
      setMissionId("");
      setListId("");
      setFile(null);
      setCsvHeaders([]);
      setPreviewRows([]);
      setMappings({ dateColumn: "" });
      setMissingEntityHandling("skip");
      setShowCampaignQuickCreate(false);
      setCampaignName("");
      setShowListQuickCreate(false);
      setListName("");
      setResult(null);
    }
  }, [isOpen, fetchMissions]);

  const mission = missions.find((m) => m.id === missionId);
  const lists = mission?.lists ?? [];

  useEffect(() => {
    setListId("");
  }, [missionId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || "";
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setCsvHeaders([]);
        setPreviewRows([]);
        return;
      }
      const delimiter = detectDelimiter(lines[0]);
      const headers = parseCSVLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));
      setCsvHeaders(headers);
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < Math.min(11, lines.length); i++) {
        const values = parseCSVLine(lines[i], delimiter).map((v) => v.replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, j) => {
          row[h] = values[j] ?? "";
        });
        rows.push(row);
      }
      setPreviewRows(rows);
      setMappings((prev) => ({
        ...prev,
        dateColumn: prev.dateColumn || headers.find((h) => /date|jour|heure/i.test(h)) || headers[0] || "",
        contactEmailColumn: prev.contactEmailColumn || headers.find((h) => /email|mail/i.test(h)) || "",
        companyNameColumn: prev.companyNameColumn || headers.find((h) => /société|company|entreprise|nom/i.test(h)) || "",
      }));
    };
    reader.readAsText(f, "UTF-8");
  };

  const canGoMapping = missionId && file && csvHeaders.length > 0;
  const canImport =
    mappings.dateColumn &&
    (mappings.contactEmailColumn || mappings.companyNameColumn);

  const handleImport = async () => {
    if (!canImport || !file || !missionId) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("missionId", missionId);
      if (listId) formData.append("listId", listId);
      formData.append("mappings", JSON.stringify(mappings));
      formData.append("missingEntityHandling", missingEntityHandling);
      const res = await fetch("/api/manager/rdv/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (json.success && json.data) {
        setShowCampaignQuickCreate(false);
        setShowListQuickCreate(false);
        setResult(json.data);
        if (json.data.created > 0) onSuccess();
      } else {
        if ((json as { code?: string }).code === "MISSION_HAS_NO_LIST") {
          const missionName = missions.find((m) => m.id === missionId)?.name || "mission";
          if (!listName) {
            setListName(`Liste import RDV - ${missionName}`);
          }
          setShowListQuickCreate(true);
        }
        if ((json as { code?: string }).code === "MISSING_ACTIVE_CAMPAIGN") {
          const missionName = missions.find((m) => m.id === missionId)?.name || "mission";
          if (!campaignName) {
            setCampaignName(`Campagne import RDV - ${missionName}`);
          }
          setShowCampaignQuickCreate(true);
        }
        setResult({
          created: 0,
          totalRows: 0,
          errors: [{ row: 0, message: (json as { error?: string }).error ?? "Erreur import" }],
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !uploading && onClose()} title="Importer des RDV" size="lg">

        {result !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, color: "var(--ink2)" }}>
              <strong>{result.created}</strong> RDV créé(s) sur <strong>{result.totalRows}</strong> ligne(s).
            </p>
            <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: -6 }}>
              Lignes ignorées: <strong>{result.skippedInvalidDate ?? 0}</strong> date(s) invalide(s),
              {" "}
              <strong>{result.skippedMissingEntity ?? 0}</strong> contact/société introuvable(s).
            </p>
            {(result.createdCompanies || result.createdContacts) ? (
              <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: -8 }}>
                Créations automatiques: <strong>{result.createdCompanies ?? 0}</strong> société(s),
                {" "}
                <strong>{result.createdContacts ?? 0}</strong> contact(s).
              </p>
            ) : null}
            {result.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12, color: "var(--red)" }}>
                {result.errors.slice(0, 20).map((e, i) => (
                  <div key={i}>Ligne {e.row}: {e.message}</div>
                ))}
                {result.errors.length > 20 && (
                  <div>… et {result.errors.length - 20} autre(s) erreur(s)</div>
                )}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="rdv-btn rdv-btn-primary" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 6 }}>Mission *</label>
                  <select
                    className="rdv-input"
                    style={{ width: "100%" }}
                    value={missionId}
                    onChange={(e) => setMissionId(e.target.value)}
                  >
                    <option value="">Sélectionner une mission</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 6 }}>Liste (optionnel)</label>
                  <select
                    className="rdv-input"
                    style={{ width: "100%" }}
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    disabled={!missionId}
                  >
                    <option value="">Toutes les listes de la mission</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 6 }}>Fichier CSV *</label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="rdv-input"
                    style={{ width: "100%" }}
                    onChange={onFileChange}
                  />
                  {file && (
                    <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{file.name} ({csvHeaders.length} colonnes)</p>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="rdv-btn rdv-btn-primary"
                    disabled={!canGoMapping}
                    onClick={() => setStep(2)}
                  >
                    Suivant → Mapping
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "var(--ink2)" }}>
                  Associez les colonnes du CSV aux champs RDV.
                </p>
                {[
                  { key: "dateColumn" as const, label: "Date du RDV *" },
                  { key: "contactEmailColumn" as const, label: "Email du contact" },
                  { key: "companyNameColumn" as const, label: "Nom de la société" },
                  { key: "meetingTypeColumn" as const, label: "Type (VISIO/PHYSIQUE/TELEPHONIQUE)" },
                  { key: "meetingCategoryColumn" as const, label: "Catégorie (EXPLORATOIRE/BESOIN)" },
                  { key: "noteColumn" as const, label: "Note" },
                  { key: "meetingAddressColumn" as const, label: "Adresse" },
                  { key: "meetingJoinUrlColumn" as const, label: "Lien visio" },
                  { key: "meetingPhoneColumn" as const, label: "Téléphone" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 4 }}>{label}</label>
                    <select
                      className="rdv-input"
                      style={{ width: "100%" }}
                      value={mappings[key] ?? ""}
                      onChange={(e) => setMappings((m) => ({ ...m, [key]: e.target.value || undefined }))}
                    >
                      <option value="">—</option>
                      {csvHeaders.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
                <p style={{ fontSize: 11, color: "var(--ink3)" }}>
                  * Au moins un des deux : Email du contact ou Nom de la société (exactement comme dans la liste de la mission).
                </p>
                <p style={{ fontSize: 11, color: "var(--ink3)" }}>
                  Dates acceptées : JJ/MM/AAAA (ou avec point ou tiret), AAAA-MM-JJ, ou numéro Excel (ex. 45321). Si seulement 3 lignes sur 9 passent, vérifiez la liste cible et l’option « Créer contact + société ».
                </p>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginBottom: 4 }}>
                    Contacts / sociétés introuvables
                  </label>
                  <select
                    className="rdv-input"
                    style={{ width: "100%" }}
                    value={missingEntityHandling}
                    onChange={(e) => setMissingEntityHandling(e.target.value as MissingEntityHandling)}
                  >
                    <option value="skip">Ignorer la ligne</option>
                    <option value="create_company">Créer la société si absente</option>
                    <option value="create_contact_and_company">Créer contact + société si absents</option>
                  </select>
                  <p style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6 }}>
                    Les dates invalides/manquantes sont ignorées automatiquement.
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <button className="rdv-btn rdv-btn-ghost" onClick={() => setStep(1)}>
                    ← Retour
                  </button>
                  <button
                    className="rdv-btn rdv-btn-primary"
                    disabled={!canImport}
                    onClick={() => setStep(3)}
                  >
                    Aperçu puis importer
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "var(--ink2)" }}>
                  Aperçu des premières lignes (mappées).
                </p>
                <div style={{ overflowX: "auto", maxHeight: 220, border: "1px solid var(--border2)", borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--surface2)" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Date</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Contact / Société</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 10px" }}>{row[mappings.dateColumn] ?? "—"}</td>
                          <td style={{ padding: "8px 10px" }}>
                            {row[mappings.contactEmailColumn ?? ""] || row[mappings.companyNameColumn ?? ""] || "—"}
                          </td>
                          <td style={{ padding: "8px 10px" }}>{row[mappings.meetingTypeColumn ?? ""] || "VISIO"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <button className="rdv-btn rdv-btn-ghost" onClick={() => setStep(2)} disabled={uploading}>
                    ← Retour
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {showListQuickCreate && (
                      <div
                        style={{
                          width: 360,
                          maxWidth: "100%",
                          border: "1px solid var(--amber-300, #fcd34d)",
                          background: "var(--amber-50, #fffbeb)",
                          borderRadius: 10,
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <p style={{ fontSize: 12, color: "var(--ink2)" }}>
                          Cette mission n&apos;a aucune liste. Creez une liste maintenant pour continuer l&apos;import.
                        </p>
                        <input
                          className="rdv-input"
                          style={{ width: "100%" }}
                          placeholder="Nom de la liste"
                          value={listName}
                          onChange={(e) => setListName(e.target.value)}
                        />
                        <button
                          className="rdv-btn rdv-btn-primary"
                          disabled={uploading || !listName.trim()}
                          onClick={async () => {
                            if (!canImport || !file || !missionId) return;
                            setUploading(true);
                            setResult(null);
                            try {
                              const formData = new FormData();
                              formData.append("file", file);
                              formData.append("missionId", missionId);
                              if (listId) formData.append("listId", listId);
                              formData.append("mappings", JSON.stringify(mappings));
                              formData.append("missingEntityHandling", missingEntityHandling);
                              formData.append("createListNow", "true");
                              formData.append("listName", listName.trim());
                              const res = await fetch("/api/manager/rdv/import", {
                                method: "POST",
                                body: formData,
                              });
                              const json = await res.json().catch(() => ({}));
                              if (json.success && json.data) {
                                setShowListQuickCreate(false);
                                setResult(json.data);
                                if (json.data.created > 0) onSuccess();
                              } else {
                                setResult({
                                  created: 0,
                                  totalRows: 0,
                                  errors: [{ row: 0, message: (json as { error?: string }).error ?? "Erreur import" }],
                                });
                              }
                            } finally {
                              setUploading(false);
                            }
                          }}
                        >
                          {uploading ? "Creation + import…" : "Creer la liste maintenant et importer"}
                        </button>
                      </div>
                    )}
                    {showCampaignQuickCreate && (
                      <div
                        style={{
                          width: 360,
                          maxWidth: "100%",
                          border: "1px solid var(--amber-300, #fcd34d)",
                          background: "var(--amber-50, #fffbeb)",
                          borderRadius: 10,
                          padding: 10,
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        <p style={{ fontSize: 12, color: "var(--ink2)" }}>
                          Aucune campagne active trouvee pour cette mission. Creez une campagne maintenant pour continuer l&apos;import.
                        </p>
                        <input
                          className="rdv-input"
                          style={{ width: "100%" }}
                          placeholder="Nom de la campagne"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                        />
                        <button
                          className="rdv-btn rdv-btn-primary"
                          disabled={uploading || !campaignName.trim()}
                          onClick={async () => {
                            if (!canImport || !file || !missionId) return;
                            setUploading(true);
                            setResult(null);
                            try {
                              const formData = new FormData();
                              formData.append("file", file);
                              formData.append("missionId", missionId);
                              if (listId) formData.append("listId", listId);
                              formData.append("mappings", JSON.stringify(mappings));
                              formData.append("missingEntityHandling", missingEntityHandling);
                              formData.append("createCampaignNow", "true");
                              formData.append("campaignName", campaignName.trim());
                              const res = await fetch("/api/manager/rdv/import", {
                                method: "POST",
                                body: formData,
                              });
                              const json = await res.json().catch(() => ({}));
                              if (json.success && json.data) {
                                setShowCampaignQuickCreate(false);
                                setResult(json.data);
                                if (json.data.created > 0) onSuccess();
                              } else {
                                setResult({
                                  created: 0,
                                  totalRows: 0,
                                  errors: [{ row: 0, message: (json as { error?: string }).error ?? "Erreur import" }],
                                });
                              }
                            } finally {
                              setUploading(false);
                            }
                          }}
                        >
                          {uploading ? "Création + import…" : "Créer campagne maintenant et importer"}
                        </button>
                      </div>
                    )}
                    <button
                      className="rdv-btn rdv-btn-primary"
                      disabled={!canImport || uploading}
                      onClick={handleImport}
                    >
                      {uploading ? "Import en cours…" : "Importer les RDV"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
    </Modal>
  );
}
