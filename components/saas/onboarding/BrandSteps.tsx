"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Globe, KeyRound, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Chip, IconButton, Input, useToast } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";
import type { StepComponentProps } from "./types";
import { MemberList } from "./TeamSteps";
import { InviteLinks } from "./InviteLinks";

// ---------------- white_label ----------------

export interface WhiteLabelDraft {
    brandName: string;
    customDomain: string;
    logoUrl: string;
    primaryColor: string;
    accentColor: string;
    senderEmail: string;
}

export const whiteLabelDefaults = (state: StepComponentProps<WhiteLabelDraft>["state"], account: { name: string }): WhiteLabelDraft => {
    const wl = (state.whiteLabel ?? {}) as Partial<WhiteLabelDraft>;
    return {
        brandName: wl.brandName ?? account.name,
        customDomain: wl.customDomain ?? "",
        logoUrl: wl.logoUrl ?? "",
        primaryColor: wl.primaryColor ?? "#1E3A8A",
        accentColor: wl.accentColor ?? "#F97316",
        senderEmail: wl.senderEmail ?? "",
    };
};

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
    return (
        <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
            <div className="flex items-center gap-2">
                <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} disabled={disabled} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1" />
                <Input size="md" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={`${label} (hex)`} />
            </div>
        </div>
    );
}

export function WhiteLabelStep({ value, onChange, state, disabled }: StepComponentProps<WhiteLabelDraft>) {
    const toast = useToast();
    const [checking, setChecking] = useState(false);
    const [dns, setDns] = useState<{ verified: boolean; message: string; target: string } | null>(null);
    const saved = (state.whiteLabel ?? {}) as { customDomain?: string; dnsVerifiedAt?: string | null };
    const set = (patch: Partial<WhiteLabelDraft>) => onChange({ ...value, ...patch });
    const savedDomain = saved.customDomain && saved.customDomain === value.customDomain;

    const checkDns = async () => {
        setChecking(true);
        const res = await saasFetch<{ verified: boolean; message: string; target: string }>("/api/saas/onboarding/white-label-dns", { method: "POST" });
        setChecking(false);
        if (!res.ok) return toast.error("Vérification impossible", res.error);
        setDns(res.data);
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="grid gap-4">
                <Input label="Nom affiché" value={value.brandName} onChange={(e) => set({ brandName: e.target.value })} disabled={disabled} />
                <Input label="Domaine personnalisé" placeholder="crm.votreagence.com" value={value.customDomain} onChange={(e) => set({ customDomain: e.target.value.trim().toLowerCase() })} disabled={disabled} icon={<Globe className="h-4 w-4" />} />
                <Input label="URL du logo (PNG/SVG)" placeholder="https://votreagence.com/logo.svg" value={value.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} disabled={disabled} hint="Facultatif. Fond transparent, 200 px de large minimum." />
                <div className="grid gap-4 sm:grid-cols-2">
                    <ColorField label="Couleur principale" value={value.primaryColor} onChange={(primaryColor) => set({ primaryColor })} disabled={disabled} />
                    <ColorField label="Couleur d'accent" value={value.accentColor} onChange={(accentColor) => set({ accentColor })} disabled={disabled} />
                </div>
                <Input label="Expéditeur des emails" type="email" placeholder="no-reply@votreagence.com" value={value.senderEmail} onChange={(e) => set({ senderEmail: e.target.value })} disabled={disabled} hint="Facultatif. Utilisé pour les invitations et rapports envoyés à vos clients." />

                {value.customDomain && (
                    <div className="rounded-xl border border-line p-4 text-[13px]">
                        <p className="font-medium text-ink">Configuration DNS</p>
                        <p className="mt-1 text-ink-3">Chez votre registrar (OVH, Gandi, Cloudflare…), créez cet enregistrement :</p>
                        <div className="mt-2 grid grid-cols-[70px_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-2 p-3 font-mono text-[12px]">
                            <span className="text-ink-3">Type</span>
                            <span>CNAME</span>
                            <span className="text-ink-3">Nom</span>
                            <span className="break-all">{value.customDomain}</span>
                            <span className="text-ink-3">Cible</span>
                            <span>{dns?.target ?? "edge.captainprospect.app"}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {saved.dnsVerifiedAt && savedDomain ? (
                                <Badge variant="success" dot>
                                    Domaine vérifié
                                </Badge>
                            ) : (
                                <Button size="sm" variant="secondary" isLoading={checking} disabled={disabled || !savedDomain} onClick={checkDns}>
                                    Vérifier le DNS
                                </Button>
                            )}
                            {!savedDomain && <span className="text-xs text-ink-3">Enregistrez l&apos;étape pour pouvoir vérifier le domaine.</span>}
                        </div>
                        {dns && (
                            <p className={`mt-2 text-xs ${dns.verified ? "text-success-ink" : "text-ink-3"}`}>
                                {dns.message} {!dns.verified && "La propagation DNS peut prendre jusqu'à 24 h : vous pouvez continuer et revenir plus tard."}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div aria-label="Aperçu" className="self-start overflow-hidden rounded-2xl border border-line shadow-xs">
                <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: value.primaryColor }}>
                    {value.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value.logoUrl} alt="" className="h-5 max-w-[90px] object-contain" />
                    ) : (
                        <span className="h-5 w-5 rounded bg-white/30" />
                    )}
                    <span className="truncate text-[13px] font-semibold text-white">{value.brandName || "Votre marque"}</span>
                </div>
                <div className="space-y-2 bg-surface p-3">
                    <p className="truncate text-[11px] text-ink-4">{value.customDomain || "crm.votreagence.com"}</p>
                    <div className="h-2 w-3/4 rounded bg-surface-3" />
                    <div className="h-2 w-1/2 rounded bg-surface-3" />
                    <button type="button" tabIndex={-1} className="mt-2 w-full rounded-lg py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: value.accentColor }}>
                        Écouter le RDV
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---------------- client_viewer ----------------

export interface ClientViewerDraft {
    invites: { email: string; name: string }[];
}

export const clientViewerDefaults = (): ClientViewerDraft => ({ invites: [{ email: "", name: "" }] });

export function clientViewerPayload(d: ClientViewerDraft) {
    return { invites: d.invites.filter((i) => i.email.trim() || i.name.trim()) };
}

export function ClientViewerStep({ value, onChange, state, refresh, disabled, result }: StepComponentProps<ClientViewerDraft>) {
    const update = (i: number, patch: Partial<ClientViewerDraft["invites"][number]>) => onChange({ invites: value.invites.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    const links = (result?.inviteLinks as { email: string; name: string; url: string }[] | undefined) ?? [];
    return (
        <div className="space-y-5">
            <ul className="grid gap-2 text-[13px] text-ink-2 sm:grid-cols-2">
                {["Écoute des RDV pris pour eux", "Rapports et statistiques de leur campagne", "Fiches de RDV générées par l'IA", "Aucun accès aux scripts, listes ou autres clients"].map((t) => (
                    <li key={t} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                        {t}
                    </li>
                ))}
            </ul>
            <MemberList state={state} refresh={refresh} roles="clients" disabled={disabled} />
            {links.length > 0 && <InviteLinks links={links} />}
            <div className="space-y-2">
                {value.invites.map((inv, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
                        <Input size="sm" placeholder="Nom du contact client" aria-label="Nom" value={inv.name} onChange={(e) => update(i, { name: e.target.value })} disabled={disabled} />
                        <Input size="sm" type="email" placeholder="contact@client.com" aria-label="Email" value={inv.email} onChange={(e) => update(i, { email: e.target.value })} disabled={disabled} />
                        <IconButton icon={Trash2} label="Retirer la ligne" size="sm" variant="danger" disabled={disabled || value.invites.length <= 1} onClick={() => onChange({ invites: value.invites.filter((_, j) => j !== i) })} />
                    </div>
                ))}
                <Button size="sm" variant="ghost" leftIcon={<Plus className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => onChange({ invites: [...value.invites, { email: "", name: "" }] })}>
                    Ajouter un client
                </Button>
            </div>
            <p className="text-xs text-ink-3">Les accès Client Spectateur ne consomment pas de siège.</p>
        </div>
    );
}

// ---------------- api_webhooks ----------------

export interface ApiDraft {
    sources: string[];
}

export const apiDefaults = (): ApiDraft => ({ sources: [] });

const SOURCES = [
    ["TYPEFORM", "Typeform"],
    ["META_ADS", "Meta Lead Ads"],
    ["GOOGLE_ADS", "Google Ads"],
    ["LINKEDIN", "Bots LinkedIn"],
    ["ZAPIER", "Zapier / Make"],
    ["CUSTOM", "Développement maison"],
] as const;

export function ApiStep({ value, onChange, state, refresh, disabled }: StepComponentProps<ApiDraft>) {
    const toast = useToast();
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const [secret, setSecret] = useState<string | null>(null);
    const keys = state.resources.apiKeys;

    const create = async () => {
        setCreating(true);
        const res = await saasFetch<{ secret: string }>("/api/saas/api-keys", { body: { name: name || "Clé principale" } });
        setCreating(false);
        if (!res.ok) return toast.error("Création impossible", res.error);
        setSecret(res.data.secret);
        setName("");
        await refresh();
    };
    const revoke = async (id: string) => {
        const res = await saasFetch(`/api/saas/api-keys/${id}`, { method: "DELETE" });
        if (!res.ok) return toast.error("Révocation impossible", res.error);
        await refresh();
    };

    return (
        <div className="space-y-5">
            <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">D&apos;où viennent vos leads entrants ?</p>
                <div className="flex flex-wrap gap-2">
                    {SOURCES.map(([key, label]) => (
                        <Chip key={key} selected={value.sources.includes(key)} disabled={disabled} onClick={() => onChange({ sources: value.sources.includes(key) ? value.sources.filter((s) => s !== key) : [...value.sources, key] })}>
                            {label}
                        </Chip>
                    ))}
                </div>
            </div>

            <div className="rounded-xl border border-line p-4">
                <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <KeyRound className="h-4 w-4 text-ink-3" aria-hidden /> Clés d&apos;API
                </p>
                {secret && (
                    <Callout tone="warning" className="mt-3" title="Copiez votre clé maintenant">
                        <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-[12px]">{secret}</code>
                            <IconButton icon={Copy} label="Copier la clé" size="xs" variant="outline" onClick={() => void navigator.clipboard?.writeText(secret).then(() => toast.success("Clé copiée"))} />
                        </div>
                        <p className="mt-1 text-[12px]">Elle ne sera plus jamais affichée. Seule son empreinte est conservée.</p>
                    </Callout>
                )}
                {keys.length > 0 && (
                    <ul className="mt-3 divide-y divide-line-subtle text-[13px]">
                        {keys.map((k) => (
                            <li key={k.id} className="flex items-center gap-2 py-2">
                                <span className="font-medium text-ink">{k.name}</span>
                                <code className="text-[12px] text-ink-3">{k.prefix}…</code>
                                <span className="ml-auto text-xs text-ink-4">créée le {new Date(k.createdAt).toLocaleDateString("fr-FR")}</span>
                                <IconButton icon={Trash2} label={`Révoquer ${k.name}`} size="xs" variant="danger" disabled={disabled} onClick={() => revoke(k.id)} />
                            </li>
                        ))}
                    </ul>
                )}
                <div className="mt-3 flex gap-2">
                    <Input size="sm" placeholder="Nom de la clé (ex. Typeform prod)" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
                    <Button size="sm" variant="secondary" isLoading={creating} disabled={disabled} onClick={create}>
                        Générer
                    </Button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-inverse p-3 text-[11.5px] leading-relaxed text-inverse-ink">
{`curl -X POST https://<votre-domaine>/api/v1/leads \\
  -H "x-api-key: cpk_live_…" \\
  -d '{"firstName":"Marie","company":"Acme","phone":"+33612345678","listId":"…"}'`}
                </pre>
            </div>
        </div>
    );
}
