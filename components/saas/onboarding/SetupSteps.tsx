"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Phone, Plus, Trash2, Wifi } from "lucide-react";
import { Badge, Button, Callout, Chip, IconButton, Input, Select, SegmentedControl, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";
import { formatQuota } from "@/lib/saas/plans";
import type { StepComponentProps } from "./types";

// ---------------- profile ----------------

export interface ProfileDraft {
    jobRole: string;
    dailyCallTarget: number;
    experience: string;
    timezone: string;
}

export const profileDefaults = (): ProfileDraft => ({
    jobRole: "",
    dailyCallTarget: 60,
    experience: "INTERMEDIATE",
    timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/Paris",
});

const JOB_ROLES = [
    { value: "SDR", label: "SDR / Business Developer" },
    { value: "CLOSER", label: "Closer / Account Executive" },
    { value: "MANAGER", label: "Manager commercial" },
    { value: "FOUNDER", label: "Dirigeant / fondateur" },
    { value: "FREELANCE", label: "Freelance / indépendant" },
    { value: "OTHER", label: "Autre" },
];

export function ProfileStep({ value, onChange, disabled }: StepComponentProps<ProfileDraft>) {
    const perHour = Math.round(value.dailyCallTarget / 6);
    return (
        <div className="grid gap-5">
            <Select label="Votre rôle" options={JOB_ROLES} value={value.jobRole} onChange={(jobRole) => onChange({ ...value, jobRole })} disabled={disabled} />
            <div>
                <label htmlFor="daily-target" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    Objectif d&apos;appels par jour : <span className="tabular-nums text-ink">{value.dailyCallTarget}</span>
                </label>
                <input
                    id="daily-target"
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={value.dailyCallTarget}
                    disabled={disabled}
                    onChange={(e) => onChange({ ...value, dailyCallTarget: Number(e.target.value) })}
                    className="w-full accent-[var(--color-primary)]"
                />
                <p className="mt-1 text-xs text-ink-3">
                    Soit environ {perHour} appels/heure sur 6 h de session. Le Pace vous alertera si vous décrochez.
                </p>
            </div>
            <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-2">Expérience en prospection téléphonique</p>
                <SegmentedControl
                    ariaLabel="Expérience"
                    value={value.experience}
                    onChange={(experience) => onChange({ ...value, experience })}
                    options={[
                        { value: "BEGINNER", label: "Débutant" },
                        { value: "INTERMEDIATE", label: "Confirmé" },
                        { value: "EXPERT", label: "Expert" },
                    ]}
                />
                {value.experience === "BEGINNER" && (
                    <p className="mt-2 text-xs text-ink-3">On affichera le script d&apos;appel et les réponses aux objections pendant vos appels.</p>
                )}
            </div>
            <Input label="Fuseau horaire" value={value.timezone} onChange={(e) => onChange({ ...value, timezone: e.target.value })} disabled={disabled} />
        </div>
    );
}

// ---------------- company / ICP ----------------

export interface CompanyDraft {
    offer: string;
    targetIndustries: string[];
    targetCompanySizes: string[];
    targetPersonas: string;
    averageDealSize: string;
}

export const companyDefaults = (): CompanyDraft => ({
    offer: "",
    targetIndustries: [],
    targetCompanySizes: [],
    targetPersonas: "",
    averageDealSize: "",
});

const INDUSTRY_SUGGESTIONS = ["SaaS / Logiciel", "Industrie", "Conseil", "Services B2B", "Immobilier", "Santé", "Finance / Assurance", "Retail", "Transport / Logistique", "BTP", "Formation", "Agences marketing"];
const SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const DEAL_SIZES = [
    { value: "<1k", label: "Moins de 1 000 €" },
    { value: "1-5k", label: "1 000 – 5 000 €" },
    { value: "5-20k", label: "5 000 – 20 000 €" },
    { value: "20-100k", label: "20 000 – 100 000 €" },
    { value: ">100k", label: "Plus de 100 000 €" },
];

export function CompanyStep({ value, onChange, disabled }: StepComponentProps<CompanyDraft>) {
    const [custom, setCustom] = useState("");
    const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
    const addCustom = () => {
        const v = custom.trim();
        if (v && !value.targetIndustries.includes(v)) onChange({ ...value, targetIndustries: [...value.targetIndustries, v] });
        setCustom("");
    };
    return (
        <div className="grid gap-5">
            <Textarea
                label="Votre offre en une phrase"
                rows={3}
                maxLength={600}
                showCount
                value={value.offer}
                onChange={(e) => onChange({ ...value, offer: e.target.value })}
                placeholder="Ex. : Nous aidons les PME industrielles à réduire de 30 % leurs coûts énergétiques grâce à un audit gratuit."
                disabled={disabled}
            />
            <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">Secteurs ciblés</p>
                <div className="flex flex-wrap gap-2">
                    {[...new Set([...INDUSTRY_SUGGESTIONS, ...value.targetIndustries])].map((s) => (
                        <Chip key={s} selected={value.targetIndustries.includes(s)} onClick={() => onChange({ ...value, targetIndustries: toggle(value.targetIndustries, s) })} disabled={disabled}>
                            {s}
                        </Chip>
                    ))}
                </div>
                <div className="mt-2 flex gap-2">
                    <Input
                        size="sm"
                        placeholder="Autre secteur…"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addCustom();
                            }
                        }}
                        disabled={disabled}
                    />
                    <Button size="sm" variant="secondary" onClick={addCustom} disabled={disabled || !custom.trim()}>
                        Ajouter
                    </Button>
                </div>
            </div>
            <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">Taille des entreprises ciblées (salariés)</p>
                <div className="flex flex-wrap gap-2">
                    {SIZES.map((s) => (
                        <Chip key={s} selected={value.targetCompanySizes.includes(s)} onClick={() => onChange({ ...value, targetCompanySizes: toggle(value.targetCompanySizes, s) })} disabled={disabled}>
                            {s}
                        </Chip>
                    ))}
                </div>
            </div>
            <Input
                label="Postes ciblés"
                value={value.targetPersonas}
                onChange={(e) => onChange({ ...value, targetPersonas: e.target.value })}
                placeholder="DAF, directeur des achats, responsable RSE…"
                disabled={disabled}
            />
            <Select label="Panier moyen d'une vente" options={DEAL_SIZES} value={value.averageDealSize} onChange={(averageDealSize) => onChange({ ...value, averageDealSize })} disabled={disabled} />
        </div>
    );
}

// ---------------- phone_line ----------------

export function PhoneLineStep({ state, refresh, disabled }: StepComponentProps<Record<string, never>>) {
    const toast = useToast();
    const [provider, setProvider] = useState<"ALLO" | "ONOFF">("ALLO");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [label, setLabel] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const lines = state.resources.phoneLines;
    const limit = state.quotas.phoneLines;
    const full = limit !== null && lines.length >= limit;

    const add = async () => {
        setError("");
        setBusy("add");
        const res = await saasFetch("/api/saas/onboarding/phone-lines", { body: { provider, phoneNumber, label: label || undefined } });
        setBusy(null);
        if (!res.ok) return setError(res.error);
        setPhoneNumber("");
        setLabel("");
        await refresh();
    };
    const remove = async (id: string) => {
        setBusy(id);
        const res = await saasFetch(`/api/saas/onboarding/phone-lines/${id}`, { method: "DELETE" });
        setBusy(null);
        if (!res.ok) return toast.error("Suppression impossible", res.error);
        await refresh();
    };
    const test = async (id: string) => {
        setBusy(`test-${id}`);
        // Leave the spinner up briefly: the check feels instant otherwise and people doubt it ran.
        const [res] = await Promise.all([
            saasFetch<{ simulated: boolean }>(`/api/saas/onboarding/phone-lines/${id}/test`, { method: "POST" }),
            new Promise((r) => setTimeout(r, 900)),
        ]);
        setBusy(null);
        if (!res.ok) return toast.error("Test échoué", res.error);
        toast.success(
            "Ligne connectée",
            res.data.simulated ? "Événement de test simulé reçu. Les vrais appels remonteront dès la configuration du webhook." : "Événement reçu depuis votre opérateur."
        );
        await refresh();
    };

    return (
        <div className="space-y-5">
            {lines.length > 0 && (
                <ul className="space-y-3">
                    {lines.map((line) => (
                        <li key={line.id} className="rounded-xl border border-line p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Phone className="h-4 w-4 text-ink-3" aria-hidden />
                                <span className="font-mono text-[13.5px] text-ink">{line.phoneNumber}</span>
                                <Badge size="sm">{line.provider === "ALLO" ? "Allo" : "OnOff"}</Badge>
                                {line.label && <span className="text-xs text-ink-3">{line.label}</span>}
                                <span className="ml-auto">
                                    {line.verifiedAt ? (
                                        <Badge variant="success" size="sm" dot>
                                            Connectée
                                        </Badge>
                                    ) : (
                                        <Badge variant="warning" size="sm" dot>
                                            En attente
                                        </Badge>
                                    )}
                                </span>
                            </div>
                            <div className="mt-3">
                                <p className="text-xs text-ink-3">
                                    1. Dans {line.provider === "ALLO" ? "Allo › Intégrations › Webhooks" : "OnOff Business › Paramètres › Webhooks"}, ajoutez cette URL pour les
                                    événements « appel terminé » et « enregistrement disponible » :
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] text-ink-2">{line.webhookUrl}</code>
                                    <IconButton
                                        icon={Copy}
                                        label="Copier l'URL"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            void navigator.clipboard?.writeText(line.webhookUrl).then(() => toast.success("URL copiée"));
                                        }}
                                    />
                                </div>
                                <p className="mt-2 text-xs text-ink-3">2. Passez un appel de test, ou lancez la vérification :</p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant={line.verifiedAt ? "secondary" : "primary"}
                                    leftIcon={busy === `test-${line.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : line.verifiedAt ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
                                    disabled={disabled || busy !== null}
                                    onClick={() => test(line.id)}
                                >
                                    {line.verifiedAt ? "Tester à nouveau" : "Tester la connexion"}
                                </Button>
                                <Button size="sm" variant="ghost" leftIcon={<Trash2 className="h-3.5 w-3.5" />} disabled={disabled || busy !== null} onClick={() => remove(line.id)}>
                                    Retirer
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {!full ? (
                <div className="rounded-xl border border-dashed border-line-strong p-4">
                    <p className="mb-3 text-[13px] font-medium text-ink-2">{lines.length === 0 ? "Ajoutez votre première ligne" : "Ajouter une ligne"}</p>
                    {error && (
                        <Callout tone="danger" className="mb-3">
                            {error}
                        </Callout>
                    )}
                    <div className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
                        <SegmentedControl<"ALLO" | "ONOFF">
                            ariaLabel="Opérateur"
                            value={provider}
                            onChange={setProvider}
                            options={[
                                { value: "ALLO", label: "Allo" },
                                { value: "ONOFF", label: "OnOff" },
                            ]}
                        />
                        <Input size="sm" label="Numéro" type="tel" placeholder="06 12 34 56 78" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={disabled} />
                        <Input size="sm" label="Libellé (facultatif)" placeholder="Ligne de Julie" value={label} onChange={(e) => setLabel(e.target.value)} disabled={disabled} />
                        <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} isLoading={busy === "add"} disabled={disabled || !phoneNumber.trim()} onClick={add}>
                            Ajouter
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-ink-3">
                    Limite de votre offre atteinte ({formatQuota(limit)} ligne{limit === 1 ? "" : "s"}).
                </p>
            )}
            <p className="text-xs text-ink-3">Pas de changement d&apos;opérateur : vous gardez vos numéros et vos applications habituelles.</p>
        </div>
    );
}

// ---------------- workspaces ----------------

export interface WorkspacesDraft {
    workspaces: { name: string; description: string; color: string }[];
}

const WS_COLORS = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#64748B"];

export const workspacesDefaults = (state: StepComponentProps<WorkspacesDraft>["state"], account: { name: string }): WorkspacesDraft => ({
    workspaces:
        state.resources.workspaces.length > 0
            ? state.resources.workspaces.map((w, i) => ({ name: w.name, description: w.description ?? "", color: w.color ?? WS_COLORS[i % WS_COLORS.length] }))
            : [{ name: account.name, description: "Workspace principal", color: WS_COLORS[0] }],
});

export function WorkspacesStep({ value, onChange, state, disabled }: StepComponentProps<WorkspacesDraft>) {
    const limit = state.quotas.workspaces;
    const update = (i: number, patch: Partial<WorkspacesDraft["workspaces"][number]>) =>
        onChange({ workspaces: value.workspaces.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
    return (
        <div className="space-y-3">
            {value.workspaces.map((ws, i) => (
                <div key={i} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[auto_1fr_1.4fr_auto] sm:items-end">
                    <div>
                        <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Couleur</span>
                        <div className="flex gap-1">
                            {WS_COLORS.slice(0, 5).map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    aria-label={`Couleur ${c}`}
                                    aria-pressed={ws.color === c}
                                    onClick={() => update(i, { color: c })}
                                    className="h-6 w-6 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink"
                                    style={{ backgroundColor: c }}
                                    disabled={disabled}
                                />
                            ))}
                        </div>
                    </div>
                    <Input size="sm" label="Nom" value={ws.name} onChange={(e) => update(i, { name: e.target.value })} disabled={disabled} />
                    <Input size="sm" label="Usage" placeholder="Offre énergie — PME Grand Est" value={ws.description} onChange={(e) => update(i, { description: e.target.value })} disabled={disabled} />
                    <IconButton
                        icon={Trash2}
                        label="Supprimer ce workspace"
                        variant="danger"
                        size="sm"
                        disabled={disabled || value.workspaces.length <= 1}
                        onClick={() => onChange({ workspaces: value.workspaces.filter((_, j) => j !== i) })}
                    />
                </div>
            ))}
            <div className="flex items-center justify-between">
                <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                    disabled={disabled || (limit !== null && value.workspaces.length >= limit)}
                    onClick={() =>
                        onChange({
                            workspaces: [...value.workspaces, { name: "", description: "", color: WS_COLORS[value.workspaces.length % WS_COLORS.length] }],
                        })
                    }
                >
                    Ajouter un workspace
                </Button>
                <span className="text-xs text-ink-3">
                    {value.workspaces.length} / {formatQuota(limit)}
                </span>
            </div>
        </div>
    );
}
