"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2, UserX } from "lucide-react";
import { Badge, Button, Checkbox, IconButton, Input, Select, Switch, Textarea, useToast } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";
import { cn } from "@/lib/utils";
import type { StepComponentProps } from "./types";
import { InviteLinks } from "./InviteLinks";

const ROLE_OPTIONS = [
    { value: "SDR", label: "SDR" },
    { value: "CLOSER", label: "Closer" },
    { value: "MANAGER", label: "Manager" },
    { value: "ADMIN", label: "Administrateur" },
];

const ROLE_LABELS: Record<string, string> = { OWNER: "Propriétaire", ADMIN: "Admin", MANAGER: "Manager", SDR: "SDR", CLOSER: "Closer", CLIENT_VIEWER: "Client" };

// ---------------- team ----------------

export interface TeamDraft {
    invites: { email: string; name: string; role: string }[];
    soloForNow: boolean;
}

export const teamDefaults = (): TeamDraft => ({ invites: [{ email: "", name: "", role: "SDR" }], soloForNow: false });

/** Rows with nothing typed are dropped before submit. */
export function teamPayload(d: TeamDraft) {
    return { soloForNow: d.soloForNow, invites: d.invites.filter((i) => i.email.trim() || i.name.trim()) };
}

export function MemberList({ state, refresh, roles, disabled }: Pick<StepComponentProps<unknown>, "state" | "refresh" | "disabled"> & { roles: "team" | "clients" }) {
    const toast = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [links, setLinks] = useState<{ email: string; name: string; role: string; url: string }[]>([]);
    const members = state.resources.members.filter((m) => (roles === "clients" ? m.role === "CLIENT_VIEWER" : m.role !== "CLIENT_VIEWER"));
    if (members.length === 0) return null;

    const act = async (id: string, method: "DELETE" | "POST") => {
        setBusy(id);
        const res = await saasFetch<{ url?: string }>(`/api/saas/members/${id}`, { method });
        setBusy(null);
        if (!res.ok) return toast.error("Action impossible", res.error);
        if (method === "POST" && res.data.url) {
            const m = members.find((x) => x.id === id)!;
            setLinks([{ email: m.email, name: m.name, role: m.role, url: res.data.url }]);
        }
        await refresh();
    };

    return (
        <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink-2">{roles === "clients" ? "Accès clients" : "Équipe actuelle"}</p>
            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
                {members.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-[13px]">
                        <span className="font-medium text-ink">{m.name}</span>
                        <span className="text-ink-3">{m.email}</span>
                        <Badge size="sm">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                        {m.status === "INVITED" && (
                            <Badge size="sm" variant="warning">
                                Invitation envoyée
                            </Badge>
                        )}
                        {m.role !== "OWNER" && (
                            <span className="ml-auto flex gap-1">
                                {m.status === "INVITED" && (
                                    <IconButton icon={RefreshCw} label="Nouveau lien d'invitation" size="xs" variant="ghost" isLoading={busy === m.id} disabled={disabled} onClick={() => act(m.id, "POST")} />
                                )}
                                <IconButton
                                    icon={m.status === "INVITED" ? Trash2 : UserX}
                                    label={m.status === "INVITED" ? "Annuler l'invitation" : "Retirer l'accès"}
                                    size="xs"
                                    variant="danger"
                                    disabled={disabled || busy !== null}
                                    onClick={() => act(m.id, "DELETE")}
                                />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            {links.length > 0 && <InviteLinks links={links} />}
        </div>
    );
}

export function TeamStep({ value, onChange, state, refresh, disabled, result }: StepComponentProps<TeamDraft>) {
    const seatsLeft = state.quotas.seats - state.usage.seats;
    const update = (i: number, patch: Partial<TeamDraft["invites"][number]>) => onChange({ ...value, invites: value.invites.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    const filled = teamPayload(value).invites.length;
    const links = (result?.inviteLinks as { email: string; name: string; role: string; url: string }[] | undefined) ?? [];

    return (
        <div className="space-y-5">
            <MemberList state={state} refresh={refresh} roles="team" disabled={disabled} />
            {links.length > 0 && <InviteLinks links={links} />}

            <div>
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-[13px] font-medium text-ink-2">Inviter</p>
                    <span className={cn("text-xs", filled > seatsLeft ? "text-danger" : "text-ink-3")}>
                        {Math.max(0, seatsLeft - filled)} siège(s) disponible(s) sur {state.quotas.seats}
                    </span>
                </div>
                <div className="space-y-2">
                    {value.invites.map((inv, i) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_1.4fr_150px_auto] sm:items-end">
                            <Input size="sm" placeholder="Prénom Nom" aria-label="Nom" value={inv.name} onChange={(e) => update(i, { name: e.target.value })} disabled={disabled || value.soloForNow} />
                            <Input size="sm" type="email" placeholder="email@entreprise.com" aria-label="Email" value={inv.email} onChange={(e) => update(i, { email: e.target.value })} disabled={disabled || value.soloForNow} />
                            <Select options={ROLE_OPTIONS} value={inv.role} onChange={(role) => update(i, { role })} disabled={disabled || value.soloForNow} />
                            <IconButton icon={Trash2} label="Retirer la ligne" size="sm" variant="danger" disabled={disabled || value.invites.length <= 1} onClick={() => onChange({ ...value, invites: value.invites.filter((_, j) => j !== i) })} />
                        </div>
                    ))}
                </div>
                <Button
                    className="mt-2"
                    size="sm"
                    variant="ghost"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    disabled={disabled || value.soloForNow || value.invites.length >= seatsLeft}
                    onClick={() => onChange({ ...value, invites: [...value.invites, { email: "", name: "", role: "SDR" }] })}
                >
                    Ajouter une personne
                </Button>
            </div>

            <Checkbox
                checked={value.soloForNow}
                onChange={(e) => onChange({ ...value, soloForNow: e.target.checked })}
                label="Je démarre seul pour l'instant"
                description="Vous pourrez inviter l'équipe plus tard depuis votre espace."
            />
            <p className="text-xs text-ink-3">
                Chaque personne reçoit un lien d&apos;activation valable 7 jours. Copiez-les et envoyez-les par Slack ou email.
            </p>
        </div>
    );
}

// ---------------- exclusions ----------------

export interface ExclusionsDraft {
    excludedDomainsText: string;
    competitorDomainsText: string;
    lockDays: number;
    excludeExistingClients: boolean;
}

export const exclusionsDefaults = (): ExclusionsDraft => ({ excludedDomainsText: "", competitorDomainsText: "", lockDays: 30, excludeExistingClients: true });

function parseDomains(text: string) {
    return [
        ...new Set(
            text
                .split(/[\s,;]+/)
                .map((d) =>
                    d
                        .trim()
                        .toLowerCase()
                        .replace(/^https?:\/\//, "")
                        .replace(/^www\./, "")
                        .replace(/\/.*$/, "")
                )
                .filter(Boolean)
        ),
    ];
}

export function exclusionsPayload(d: ExclusionsDraft) {
    return {
        excludedDomains: parseDomains(d.excludedDomainsText),
        competitorDomains: parseDomains(d.competitorDomainsText),
        lockDays: d.lockDays,
        excludeExistingClients: d.excludeExistingClients,
    };
}

export function ExclusionsStep({ value, onChange, disabled }: StepComponentProps<ExclusionsDraft>) {
    const p = exclusionsPayload(value);
    return (
        <div className="grid gap-5">
            <Textarea
                label="Clients actuels à ne jamais prospecter (domaines)"
                rows={4}
                placeholder={"client1.fr\nclient2.com"}
                value={value.excludedDomainsText}
                onChange={(e) => onChange({ ...value, excludedDomainsText: e.target.value })}
                hint={`${p.excludedDomains.length} domaine(s) — un par ligne, ou séparés par des virgules. Vous pouvez coller une colonne Excel.`}
                disabled={disabled}
            />
            <Textarea
                label="Concurrents (domaines)"
                rows={2}
                value={value.competitorDomainsText}
                onChange={(e) => onChange({ ...value, competitorDomainsText: e.target.value })}
                hint={`${p.competitorDomains.length} domaine(s)`}
                disabled={disabled}
            />
            <div>
                <label htmlFor="lock-days" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    Anti-collision : une entreprise reste attribuée à son commercial pendant <span className="tabular-nums text-ink">{value.lockDays}</span> jours
                </label>
                <input
                    id="lock-days"
                    type="range"
                    min={0}
                    max={180}
                    step={5}
                    value={value.lockDays}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...value, lockDays: Number(e.target.value) })}
                    className="w-full accent-[var(--color-primary)]"
                />
                <p className="mt-1 text-xs text-ink-3">Après le premier appel, les autres commerciaux ne voient plus cette entreprise dans leur file.</p>
            </div>
            <Switch
                checked={value.excludeExistingClients}
                onChange={(excludeExistingClients) => onChange({ ...value, excludeExistingClients })}
                label="Exclure automatiquement les entreprises ayant déjà un RDV pris"
                disabled={disabled}
            />
        </div>
    );
}

// ---------------- manager_cockpit ----------------

export interface CockpitDraft {
    callsPerHour: number;
    meetingsPerWeek: number;
    workStart: string;
    workEnd: string;
    workDays: string[];
    alertBelowPacePercent: number;
}

export const cockpitDefaults = (): CockpitDraft => ({
    callsPerHour: 12,
    meetingsPerWeek: 5,
    workStart: "09:00",
    workEnd: "18:00",
    workDays: ["MON", "TUE", "WED", "THU", "FRI"],
    alertBelowPacePercent: 70,
});

const DAYS = [
    ["MON", "Lun"],
    ["TUE", "Mar"],
    ["WED", "Mer"],
    ["THU", "Jeu"],
    ["FRI", "Ven"],
    ["SAT", "Sam"],
    ["SUN", "Dim"],
] as const;

export function CockpitStep({ value, onChange, state, disabled }: StepComponentProps<CockpitDraft>) {
    const hours = Math.max(0, (Number(value.workEnd.slice(0, 2)) * 60 + Number(value.workEnd.slice(3)) - (Number(value.workStart.slice(0, 2)) * 60 + Number(value.workStart.slice(3)))) / 60 - 1);
    const weeklyCalls = Math.round(value.callsPerHour * hours * value.workDays.length);
    const team = Math.max(1, state.usage.seats);
    return (
        <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Appels par heure (par commercial)" type="number" min={1} max={120} value={value.callsPerHour} onChange={(e) => onChange({ ...value, callsPerHour: Number(e.target.value) || 0 })} disabled={disabled} />
            <Input label="RDV par semaine (par commercial)" type="number" min={0} max={200} value={value.meetingsPerWeek} onChange={(e) => onChange({ ...value, meetingsPerWeek: Number(e.target.value) || 0 })} disabled={disabled} />
            <Input label="Début de journée" type="time" value={value.workStart} onChange={(e) => onChange({ ...value, workStart: e.target.value })} disabled={disabled} />
            <Input label="Fin de journée" type="time" value={value.workEnd} onChange={(e) => onChange({ ...value, workEnd: e.target.value })} disabled={disabled} />
            <div className="sm:col-span-2">
                <p className="mb-2 text-[13px] font-medium text-ink-2">Jours travaillés</p>
                <div className="flex flex-wrap gap-1.5">
                    {DAYS.map(([key, label]) => {
                        const on = value.workDays.includes(key);
                        return (
                            <button
                                key={key}
                                type="button"
                                aria-pressed={on}
                                disabled={disabled}
                                onClick={() => onChange({ ...value, workDays: on ? value.workDays.filter((d) => d !== key) : [...value.workDays, key] })}
                                className={cn("h-9 w-12 rounded-lg border text-[13px]", on ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-ink-2")}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="sm:col-span-2">
                <label htmlFor="pace-alert" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    M&apos;alerter quand un commercial passe sous <span className="tabular-nums text-ink">{value.alertBelowPacePercent} %</span> de son rythme
                </label>
                <input id="pace-alert" type="range" min={10} max={100} step={5} value={value.alertBelowPacePercent} disabled={disabled} onChange={(e) => onChange({ ...value, alertBelowPacePercent: Number(e.target.value) })} className="w-full accent-[var(--color-primary)]" />
            </div>
            <div className="rounded-xl bg-surface-2 p-4 text-[13px] text-ink-2 sm:col-span-2">
                Avec ces objectifs, une équipe de {team} personne{team > 1 ? "s" : ""} vise environ{" "}
                <strong className="tabular-nums text-ink">{(weeklyCalls * team).toLocaleString("fr-FR")} appels</strong> et{" "}
                <strong className="tabular-nums text-ink">{value.meetingsPerWeek * team} RDV</strong> par semaine (1 h de pause déduite par jour).
            </div>
        </div>
    );
}
