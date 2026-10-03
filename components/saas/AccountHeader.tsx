"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge, IconButton } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";
import { cn } from "@/lib/utils";

interface AccountHeaderProps {
    accountName: string;
    planName: string;
    memberName: string;
    status: string;
    trialDaysLeft: number | null;
    onboardingDone: boolean;
    isAdmin: boolean;
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" }> = {
    TRIALING: { label: "Essai", variant: "info" },
    ACTIVE: { label: "Actif", variant: "success" },
    PENDING_PAYMENT: { label: "Paiement en attente", variant: "warning" },
    TRIAL_EXPIRED: { label: "Essai terminé", variant: "danger" },
    CANCELED: { label: "Résilié", variant: "default" },
};

export function AccountHeader(props: AccountHeaderProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [leaving, setLeaving] = useState(false);
    const badge = STATUS_BADGE[props.status] ?? STATUS_BADGE.ACTIVE;

    const nav = [
        { href: "/espace", label: "Accueil" },
        { href: "/espace/onboarding", label: props.onboardingDone ? "Configuration" : "Onboarding" },
        ...(props.isAdmin ? [{ href: "/espace/abonnement", label: "Abonnement" }] : []),
    ];

    const logout = async () => {
        setLeaving(true);
        await saasFetch("/api/saas/logout", { method: "POST" });
        router.push("/espace/connexion");
        router.refresh();
    };

    return (
        <>
            <header className="sticky top-0 z-30 border-b border-line-subtle bg-surface/90 backdrop-blur">
                <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
                    <Link href="/espace" aria-label="Accueil de votre espace">
                        <BrandLogo height={22} />
                    </Link>
                    <nav className="hidden items-center gap-1 sm:flex" aria-label="Espace client">
                        {nav.map((item) => {
                            const active = item.href === "/espace" ? pathname === "/espace" : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "rounded-lg px-3 py-1.5 text-[13px]",
                                        active ? "bg-surface-3 font-medium text-ink" : "text-ink-3 hover:text-ink"
                                    )}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="ml-auto flex min-w-0 items-center gap-3">
                        <div className="hidden min-w-0 text-right md:block">
                            <p className="truncate text-[13px] font-medium text-ink">{props.accountName}</p>
                            <p className="truncate text-[11.5px] text-ink-3">
                                {props.memberName} · {props.planName}
                            </p>
                        </div>
                        <Badge variant={badge.variant} size="sm" dot>
                            {badge.label}
                        </Badge>
                        <IconButton icon={LogOut} label="Se déconnecter" variant="ghost" size="sm" isLoading={leaving} onClick={logout} />
                    </div>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden" aria-label="Espace client (mobile)">
                    {nav.map((item) => (
                        <Link key={item.href} href={item.href} className="shrink-0 rounded-lg px-3 py-1 text-[13px] text-ink-2 hover:bg-surface-3">
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </header>

            {props.status === "TRIALING" && props.trialDaysLeft !== null && (
                <div className={cn("border-b px-4 py-2 text-center text-[13px]", props.trialDaysLeft <= 3 ? "border-warning-line bg-warning-soft text-warning-ink" : "border-info-line bg-info-soft text-info-ink")}>
                    {props.trialDaysLeft === 0
                        ? "Dernier jour d'essai."
                        : `Il vous reste ${props.trialDaysLeft} jour${props.trialDaysLeft > 1 ? "s" : ""} d'essai gratuit.`}{" "}
                    {props.isAdmin && (
                        <Link href="/espace/paiement" className="font-semibold underline underline-offset-2">
                            Activer l&apos;abonnement
                        </Link>
                    )}
                </div>
            )}
        </>
    );
}
