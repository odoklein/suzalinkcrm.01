"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Callout, Input } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";

/** Only same-site relative paths under /espace are honoured as ?next=. */
function safeNext(value: string | null): string | null {
    if (!value || !value.startsWith("/espace") || value.startsWith("//")) return null;
    return value;
}

export function LoginPanel() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!email || !password) {
            setError("Renseignez votre email et votre mot de passe.");
            return;
        }
        setLoading(true);
        const res = await saasFetch<{ next: string }>("/api/saas/login", { body: { email, password } });
        if (!res.ok) {
            setLoading(false);
            setError(res.error);
            return;
        }
        // The server's destination wins when payment or onboarding is pending.
        const requested = safeNext(params.get("next"));
        const target = res.data.next === "/espace" && requested ? requested : res.data.next;
        router.push(target);
        router.refresh();
    };

    return (
        <div className="mx-auto w-full max-w-sm px-4 py-16">
            <h1 className="text-xl font-semibold text-ink">Connexion à votre espace</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">Onboarding, abonnement et réglages de votre compte.</p>
            <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xs" noValidate>
                {error && <Callout tone="danger">{error}</Callout>}
                <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Input
                    label="Mot de passe"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <Button type="submit" fullWidth size="lg" isLoading={loading}>
                    Se connecter
                </Button>
            </form>
            <p className="mt-4 text-center text-[13px] text-ink-3">
                Pas encore de compte ?{" "}
                <Link href="/tarifs" className="font-medium text-link hover:underline">
                    Voir les offres
                </Link>
            </p>
        </div>
    );
}
