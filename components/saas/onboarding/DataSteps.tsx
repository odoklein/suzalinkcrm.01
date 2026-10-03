"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { Database, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { Badge, Button, Callout, Input, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { DEFAULT_CALL_OUTCOMES } from "@/lib/saas/call-outcomes";
import { CONTACT_FIELDS, analyzeRows, guessMapping } from "@/lib/saas/contact-import";
import type { StepComponentProps } from "./types";

// ---------------- import_contacts ----------------

export type ImportDraft =
    | { source: "file"; fileName: string; rowCount: number; validCount: number; duplicateCount: number; mapping: Record<string, string>; sample: Record<string, string>[] }
    | { source: "demo" }
    | { source: "none" };

export const importDefaults = (): ImportDraft => ({ source: "none" });

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export function ImportContactsStep({ value, onChange, state, disabled }: StepComponentProps<ImportDraft>) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [rows, setRows] = useState<Record<string, string>[] | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [parsing, setParsing] = useState(false);
    const [error, setError] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const remaining = Math.max(0, state.quotas.contacts - state.usage.contacts);

    const handleFile = (file: File) => {
        setError("");
        if (!/\.(csv|txt)$/i.test(file.name)) {
            setError("Format attendu : CSV. Depuis Excel : Fichier › Enregistrer sous › CSV UTF-8.");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            setError("Fichier trop volumineux (20 Mo maximum). Découpez-le en plusieurs imports.");
            return;
        }
        setParsing(true);
        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: "greedy",
            worker: false,
            complete: (res) => {
                setParsing(false);
                const fields = (res.meta.fields ?? []).filter(Boolean);
                if (fields.length === 0 || res.data.length === 0) {
                    setError("Fichier vide ou sans ligne d'en-tête.");
                    return;
                }
                const mapping = guessMapping(fields);
                const analysis = analyzeRows(res.data, mapping);
                setRows(res.data);
                setHeaders(fields);
                onChange({ source: "file", fileName: file.name, mapping, ...analysis });
            },
            error: () => {
                setParsing(false);
                setError("Lecture du fichier impossible. Vérifiez qu'il s'agit d'un CSV valide.");
            },
        });
    };

    const remap = (header: string, field: string) => {
        if (value.source !== "file" || !rows) return;
        const mapping = { ...value.mapping, [header]: field };
        onChange({ ...value, mapping, ...analyzeRows(rows, mapping) });
    };

    const overQuota = value.source === "file" && value.validCount > remaining;

    return (
        <div className="space-y-5">
            <p className="text-xs text-ink-3">
                Capacité restante : <strong className="text-ink-2 tabular-nums">{remaining.toLocaleString("fr-FR")}</strong> contacts
                {state.usage.contacts > 0 && ` (${state.usage.contacts.toLocaleString("fr-FR")} déjà importés)`}.
            </p>

            {value.source !== "file" && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f && !disabled) handleFile(f);
                    }}
                    className={cn(
                        "flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
                        dragOver ? "border-primary bg-primary-50/40" : "border-line-strong"
                    )}
                >
                    <Upload className="h-7 w-7 text-ink-3" aria-hidden />
                    <p className="mt-3 text-[14px] font-medium text-ink">Glissez votre fichier CSV ici</p>
                    <p className="mt-1 text-xs text-ink-3">Export HubSpot, Pipedrive, Lemlist, Excel… Les colonnes sont reconnues automatiquement.</p>
                    <Button className="mt-4" size="sm" variant="secondary" isLoading={parsing} disabled={disabled} onClick={() => inputRef.current?.click()}>
                        Choisir un fichier
                    </Button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".csv,text/csv,.txt"
                        className="sr-only"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                            e.target.value = "";
                        }}
                    />
                </div>
            )}

            {error && <Callout tone="danger">{error}</Callout>}

            {value.source === "file" && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                        <FileSpreadsheet className="h-4 w-4 text-ink-3" aria-hidden />
                        <span className="text-[13px] font-medium text-ink">{value.fileName}</span>
                        <Badge size="sm">{value.rowCount.toLocaleString("fr-FR")} lignes</Badge>
                        <Badge size="sm" variant="success">
                            {value.validCount.toLocaleString("fr-FR")} exploitables
                        </Badge>
                        {value.duplicateCount > 0 && (
                            <Badge size="sm" variant="warning">
                                {value.duplicateCount} doublons ignorés
                            </Badge>
                        )}
                        <Button
                            size="xs"
                            variant="ghost"
                            className="ml-auto"
                            leftIcon={<RotateCcw className="h-3 w-3" />}
                            onClick={() => {
                                setRows(null);
                                onChange({ source: "none" });
                            }}
                        >
                            Changer de fichier
                        </Button>
                    </div>

                    {rows ? (
                        <div>
                            <p className="mb-2 text-[13px] font-medium text-ink-2">Correspondance des colonnes</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {headers.map((h) => (
                                    <label key={h} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                                        <span className="min-w-0 flex-1 truncate text-ink-2" title={h}>
                                            {h}
                                        </span>
                                        <select
                                            className="rounded-md border border-line bg-surface px-2 py-1 text-[12.5px]"
                                            value={value.mapping[h] ?? "ignore"}
                                            onChange={(e) => remap(h, e.target.value)}
                                            disabled={disabled}
                                        >
                                            {CONTACT_FIELDS.map((f) => (
                                                <option key={f.key} value={f.key}>
                                                    {f.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-ink-3">Brouillon restauré. Rechargez le fichier pour modifier la correspondance des colonnes.</p>
                    )}

                    {value.sample.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-line">
                            <table className="w-full text-left text-[12.5px]">
                                <caption className="sr-only">Aperçu des premiers contacts</caption>
                                <thead className="bg-surface-2 text-ink-3">
                                    <tr>
                                        {["Contact", "Entreprise", "Poste", "Téléphone", "Email"].map((h) => (
                                            <th key={h} scope="col" className="px-3 py-2 font-medium">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {value.sample.map((r, i) => (
                                        <tr key={i} className="border-t border-line-subtle">
                                            <td className="px-3 py-2">{r.name || "—"}</td>
                                            <td className="px-3 py-2">{r.company || "—"}</td>
                                            <td className="px-3 py-2">{r.title || "—"}</td>
                                            <td className="px-3 py-2 font-mono">{r.phone || "—"}</td>
                                            <td className="px-3 py-2">{r.email || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {overQuota && (
                        <Callout tone="warning">
                            {value.validCount.toLocaleString("fr-FR")} contacts dépassent votre capacité restante ({remaining.toLocaleString("fr-FR")}). Réduisez le
                            fichier ou activez l&apos;abonnement pour lever la limite d&apos;essai.
                        </Callout>
                    )}
                </div>
            )}

            {value.source !== "file" && (
                <button
                    type="button"
                    onClick={() => onChange(value.source === "demo" ? { source: "none" } : { source: "demo" })}
                    disabled={disabled}
                    aria-pressed={value.source === "demo"}
                    className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                        value.source === "demo" ? "border-primary bg-primary-50/40 ring-1 ring-primary" : "border-line hover:border-line-strong"
                    )}
                >
                    <Database className="mt-0.5 h-4 w-4 text-ink-3" aria-hidden />
                    <span>
                        <span className="block text-[13.5px] font-medium text-ink">Pas de fichier sous la main ? Utiliser 40 contacts de démonstration</span>
                        <span className="mt-0.5 block text-xs text-ink-3">Pour découvrir la file d&apos;appels tout de suite. Vous importerez votre vraie base plus tard.</span>
                    </span>
                </button>
            )}
        </div>
    );
}

// ---------------- call_outcomes ----------------

export interface OutcomesDraft {
    outcomes: { key: string; label: string; enabled: boolean; recycleAfterDays: number | null }[];
}

export const outcomesDefaults = (): OutcomesDraft => ({ outcomes: DEFAULT_CALL_OUTCOMES.map((o) => ({ ...o })) });

export function CallOutcomesStep({ value, onChange, disabled }: StepComponentProps<OutcomesDraft>) {
    const update = (i: number, patch: Partial<OutcomesDraft["outcomes"][number]>) =>
        onChange({ outcomes: value.outcomes.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
    return (
        <div className="space-y-2">
            <div className="hidden grid-cols-[auto_1fr_150px] gap-3 px-3 text-xs text-ink-3 sm:grid">
                <span>Actif</span>
                <span>Libellé du bouton</span>
                <span>Rappeler automatiquement</span>
            </div>
            {value.outcomes.map((o, i) => (
                <div key={o.key} className={cn("grid items-center gap-3 rounded-xl border border-line p-3 sm:grid-cols-[auto_1fr_150px]", !o.enabled && "opacity-60")}>
                    <Switch
                        checked={o.enabled}
                        onChange={(enabled) => update(i, { enabled })}
                        disabled={disabled || o.key === "MEETING_BOOKED"}
                        ariaLabel={`Activer ${o.label}`}
                        size="sm"
                    />
                    <Input size="sm" value={o.label} onChange={(e) => update(i, { label: e.target.value })} disabled={disabled || !o.enabled} aria-label="Libellé" />
                    {o.recycleAfterDays === null ? (
                        <span className="text-xs text-ink-3">{o.key === "MEETING_BOOKED" ? "Transmis au closer" : "Jamais"}</span>
                    ) : (
                        <label className="flex items-center gap-2 text-xs text-ink-3">
                            après
                            <input
                                type="number"
                                min={0}
                                max={365}
                                value={o.recycleAfterDays}
                                onChange={(e) => update(i, { recycleAfterDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
                                disabled={disabled || !o.enabled}
                                className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-[13px] text-ink"
                            />
                            jours
                        </label>
                    )}
                </div>
            ))}
            <p className="pt-2 text-xs text-ink-3">
                Le recyclage remet automatiquement le contact dans la file après le délai : un « barrage standard » sera retenté dans 5 jours sans que
                personne n&apos;ait à y penser.
            </p>
        </div>
    );
}
