"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Callout, Input, LoadingState } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Administrateur",
    MANAGER: "Manager",
    SDR: "SDR",
    CLOSER: "Closer",
    CLIENT_VIEWER: "Client spectateur",
};

interface Invite {
    email: string;
    name: string;
    role: string;
    accountName: string;
}

export function AcceptInvite({ token }: { token: string }) {
    const router = useRouter();
    const [invite, setInvite] = useState<Invite | null>(null);
    const [loadError, setLoadError] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const ctrl = new AbortController();
        saasFetch<Invite>(`/api/saas/invitations/${encodeURIComponent(token)}`, { signal: ctrl.signal }).then((res) => {
            if (res.ok) {
                setInvite(res.data);
                setName(res.data.name);
            } else if (res.status !== 0) {
                setLoadError(res.error);
            }
        });
        return () => ctrl.abort();
    }, [token]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        const res = await saasFetch<{ next: string }>(`/api/saas/invitations/${encodeURIComponent(token)}`, {
            body: { name, password },
        });
        if (!res.ok) {
            setLoading(false);
            setError(res.error);
            return;
        }
        router.push(res.data.next);
        router.refresh();
    };

    if (loadError) {
        return (
            <div className="mx-auto max-w-sm px-4 py-16">
                <Callout tone="danger" title="Lien inutilisable">
                    {loadError}
                </Callout>
                <p className="mt-4 text-[13px] text-ink-3">
                    Déjà activé ?{" "}
                    <Link href="/espace/connexion" className="font-medium text-link hover:underline">
                        Se connecter
                    </Link>
                </p>
            </div>
        );
    }
    if (!invite) return <LoadingState message="Vérification de l'invitation…" />;

    return (
        <div className="mx-auto w-full max-w-sm px-4 py-16">
            <h1 className="text-xl font-semibold text-ink">Rejoindre {invite.accountName}</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">
                Vous êtes invité en tant que <strong>{ROLE_LABELS[invite.role] ?? invite.role}</strong> avec l&apos;adresse {invite.email}.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xs" noValidate>
                {error && <Callout tone="danger">{error}</Callout>}
                <Input label="Nom complet" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                <Input
                    label="Choisissez un mot de passe"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    hint="10 caractères minimum, avec au moins une lettre et un chiffre."
                    required
                />
                <Button type="submit" fullWidth size="lg" isLoading={loading}>
                    Activer mon compte
                </Button>
            </form>
        </div>
    );
}
