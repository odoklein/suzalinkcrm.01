"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { SidebarProvider, useSidebar } from "./SidebarProvider";
import { PermissionProvider } from "@/lib/permissions/PermissionProvider";
import { GlobalSidebar, MobileMenuButton } from "./GlobalSidebar";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { SectionTabs } from "./SectionTabs";
import { NavSection, getNavByRole, ROLE_CONFIG } from "@/lib/navigation/config";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { IncomingCallPanel } from "@/components/incoming-calls/IncomingCallPanel";
import { Button, IconButton, Modal, Spinner } from "@/components/ui";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { DailyReportModal } from "@/components/sdr/DailyReportModal";
import { useSdrDailyReport } from "@/components/sdr/useSdrDailyReport";
import { cn } from "@/lib/utils";
import { RefreshCw, AlertTriangle, BellRing, CheckCircle2, PhoneCall } from "lucide-react";

interface AppLayoutShellProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    customNavigation?: NavSection[];
}

type SdrCallbackAlert = {
    id: string;
    callbackDate: string;
    note?: string | null;
    contact?: {
        firstName?: string | null;
        lastName?: string | null;
        company?: { name?: string | null } | null;
    } | null;
    company?: { name?: string | null } | null;
    mission?: {
        name?: string | null;
        client?: { name?: string | null } | null;
    } | null;
};

function InnerLayout({
    children,
    allowedRoles,
    customNavigation,
}: AppLayoutShellProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const { isCollapsed, searchOpen, closeSearch } = useSidebar();

    const userRole = session?.user?.role as UserRole | undefined;
    const roleConfig = userRole ? ROLE_CONFIG[userRole] : null;
    const isSdrArea = userRole === UserRole.SDR && pathname.startsWith("/sdr");

    const dailyReport = useSdrDailyReport(isSdrArea);
    const [callbackAlert, setCallbackAlert] = useState<SdrCallbackAlert | null>(null);

    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated") {
            router.push("/login");
            return;
        }

        if (status === "authenticated") {
            if (userRole && !allowedRoles.includes(userRole)) {
                router.push("/unauthorized");
            }
        }
    }, [session, status, router, allowedRoles, userRole]);

    useEffect(() => {
        if (!isSdrArea) {
            setCallbackAlert(null);
            return;
        }

        let cancelled = false;

        const checkDueCallbacks = async () => {
            try {
                const res = await fetch("/api/sdr/callbacks?limit=500", { cache: "no-store" });
                const json = await res.json();
                if (!res.ok || !json.success || !Array.isArray(json.data) || cancelled) return;

                const now = Date.now();
                const recentWindowMs = 10 * 60 * 1000;
                const dueCallbacks = (json.data as SdrCallbackAlert[])
                    .filter((callback) => {
                        if (!callback.callbackDate) return false;
                        const callbackTime = new Date(callback.callbackDate).getTime();
                        if (Number.isNaN(callbackTime)) return false;
                        const elapsed = now - callbackTime;
                        if (elapsed < 0 || elapsed > recentWindowMs) return false;
                        const storageKey = `sdr_callback_alert:${callback.id}:${callback.callbackDate}`;
                        return sessionStorage.getItem(storageKey) !== "shown";
                    })
                    .sort(
                        (a, b) =>
                            new Date(a.callbackDate).getTime() -
                            new Date(b.callbackDate).getTime(),
                    );

                const nextAlert = dueCallbacks[0];
                if (!nextAlert) return;

                sessionStorage.setItem(
                    `sdr_callback_alert:${nextAlert.id}:${nextAlert.callbackDate}`,
                    "shown",
                );
                setCallbackAlert(nextAlert);
            } catch {
                // The callbacks page remains available if background polling fails.
            }
        };

        const handleVisibility = () => {
            if (document.visibilityState === "visible") void checkDueCallbacks();
        };

        void checkDueCallbacks();
        const interval = window.setInterval(checkDueCallbacks, 30_000);
        document.addEventListener("visibilitychange", handleVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [isSdrArea]);

    if (status === "loading" || !session || (userRole && !allowedRoles.includes(userRole))) {
        return (
            <div role="status" aria-live="polite" className="flex min-h-dvh items-center justify-center bg-canvas">
                <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
                    <BrandLogo variant="mark" height={40} priority />
                    <div className="flex items-center gap-2 text-sm font-medium text-ink-3">
                        <Spinner className="size-4 text-accent" label="" />
                        Chargement de votre espace…
                    </div>
                </div>
            </div>
        );
    }

    const navigation =
        customNavigation || (userRole ? getNavByRole(userRole) : []);

    // Old standalone full-screen email pages (no sidebar)
    const isLegacyEmailPage =
        pathname === "/sdr/email" || pathname === "/manager/email";
    if (isLegacyEmailPage) {
        return (
            <div className="h-screen w-screen overflow-hidden flex flex-col bg-surface-2">
                {children}
            </div>
        );
    }

    // New Email Hub — needs sidebar but NOT the padded cp-content wrapper
    const isEmailHub =
        pathname.startsWith("/manager/emails") ||
        pathname.startsWith("/sdr/emails");
    // Only the SAS RDV workspace itself owns its scrolling. A prefix match here
    // also caught /manager/rdv-absences, which then rendered inside an
    // overflow-hidden box of fixed height: the page could not scroll and every
    // row below the fold was unreachable.
    const isRdvPage =
        pathname === "/manager/rdv" || pathname.startsWith("/manager/rdv/");
    // Support Technique is a board you work from, not a document you read: it
    // owns its own scrolling so the rows fill the screen instead of sitting
    // under a page-height stack of chrome, capped at 1440px.
    const isTicketBoard =
        pathname === "/manager/tickets" || pathname === "/developer/tickets";
    // The planning board is the same kind of surface: it sizes its rows and
    // columns to the space it gets, so it must get all of it.
    const isPlanningBoard =
        pathname === "/manager/planning" || pathname === "/sdr/planning";

    const pathParts = pathname.split("/").filter(Boolean);
    const rawPage = pathParts[pathParts.length - 1]?.replace(/-/g, " ") || "Dashboard";
    const pageLabels: Record<string, string> = {
        dashboard: "Tableau de bord",
        prospection: "Appels",
        listing: "Listing",
        missions: "Missions",
        clients: "Clients",
        team: "Performance",
        planning: "Planning",
        projects: "Projets",
        emails: "Email Hub",
    };
    const currentPage = pageLabels[rawPage?.toLowerCase()] || rawPage;

    return (
        <div className="cp-layout">
            <a href="#main-content" className="skip-link">
                Aller au contenu
            </a>
            <GlobalSearchModal
                open={searchOpen}
                onClose={closeSearch}
                navigation={navigation}
            />
            <GlobalSidebar navigation={navigation} />

            <main
                className={cn(
                    "cp-main",
                    // Hovering a collapsed sidebar only peeks it over the page
                    // (it has its own shadow for that): pushing the page aside
                    // on every pass of the pointer reflowed the whole screen.
                    isCollapsed ? "cp-main-collapsed" : "cp-main-expanded"
                )}
            >
                <header className="cp-topbar">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                        <MobileMenuButton />
                        <SectionTabs
                            navigation={navigation}
                            fallback={{ root: roleConfig?.label || "App", current: currentPage }}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        {isSdrArea && dailyReport.status && (
                            <button
                                type="button"
                                onClick={dailyReport.open}
                                className={cn(
                                    "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                                    dailyReport.submitted
                                        ? "border-success-line bg-success-soft text-success-ink hover:brightness-[0.97]"
                                        : dailyReport.mustFill
                                          ? "border-warning-line bg-warning-soft text-warning-ink shadow-xs hover:brightness-[0.97]"
                                          : "border-line bg-surface text-ink-2 hover:text-ink hover:border-line-strong hover:bg-surface-2",
                                )}
                                title={
                                    dailyReport.submitted
                                        ? "Retour du jour envoyé — cliquez pour le modifier"
                                        : `Retour journée obligatoire à partir de ${dailyReport.status.promptTime}`
                                }
                            >
                                {dailyReport.submitted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-success" aria-hidden />
                                ) : dailyReport.mustFill ? (
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-warning" aria-hidden />
                                ) : null}
                                {dailyReport.submitted ? "Retour du jour envoyé" : "Retour journée"}
                            </button>
                        )}
                        <IconButton
                            icon={RefreshCw}
                            label="Rafraîchir la page"
                            variant="outline"
                            size="sm"
                            onClick={() => router.refresh()}
                        />
                        <NotificationBell />
                    </div>
                </header>

                {isEmailHub || isRdvPage || isTicketBoard || isPlanningBoard ? (
                    // Email Hub & SAS RDV: fill remaining height, no outer padding wrapper, dedicated inner scroll
                    <div id="main-content" tabIndex={-1} className="flex-1 overflow-hidden flex flex-col min-h-0 outline-none" style={{ height: 'calc(100dvh - 56px)' }}>
                        {children}
                    </div>
                ) : (
                    <div id="main-content" tabIndex={-1} className="cp-content outline-none">
                        <div className="max-w-[1440px] mx-auto w-full">
                            {children}
                        </div>
                    </div>
                )}

                <DailyReportModal
                    isOpen={dailyReport.isOpen && !callbackAlert}
                    blocking={dailyReport.mustFill}
                    onClose={dailyReport.close}
                    status={dailyReport.status}
                    onSubmitted={dailyReport.markSubmitted}
                />

                <Modal
                    isOpen={!!callbackAlert}
                    onClose={() => setCallbackAlert(null)}
                    title="Rappel à effectuer maintenant"
                    description="L'heure prévue pour ce rappel vient d'arriver."
                    size="sm"
                >
                    {callbackAlert && (
                        <div className="space-y-4">
                            <div className="rounded-panel border border-warning-line bg-warning-soft p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-warning text-white flex items-center justify-center shrink-0">
                                        <BellRing className="w-5 h-5" aria-hidden />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-ink">
                                            {[
                                                callbackAlert.contact?.firstName,
                                                callbackAlert.contact?.lastName,
                                            ].filter(Boolean).join(" ") ||
                                                callbackAlert.contact?.company?.name ||
                                                callbackAlert.company?.name ||
                                                "Contact à rappeler"}
                                        </p>
                                        <p className="text-xs text-ink-2 mt-1">
                                            {callbackAlert.contact?.company?.name ||
                                                callbackAlert.company?.name ||
                                                callbackAlert.mission?.client?.name ||
                                                "Société non renseignée"}
                                            {callbackAlert.mission?.name
                                                ? ` · ${callbackAlert.mission.name}`
                                                : ""}
                                        </p>
                                        <p className="text-xs font-semibold text-warning-ink mt-2">
                                            Prévu à{" "}
                                            {new Date(callbackAlert.callbackDate).toLocaleTimeString("fr-FR", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </div>
                                {callbackAlert.note && (
                                    <p className="mt-3 pt-3 border-t border-warning-line text-xs text-ink-2">
                                        {callbackAlert.note}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => setCallbackAlert(null)}>
                                    Fermer
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    leftIcon={<PhoneCall className="w-4 h-4" aria-hidden />}
                                    onClick={() => {
                                        setCallbackAlert(null);
                                        router.push("/sdr/callbacks");
                                    }}
                                >
                                    Ouvrir le rappel
                                </Button>
                            </div>
                        </div>
                    )}
                </Modal>

                <IncomingCallPanel />
            </main>
        </div>
    );
}

export function AppLayoutShell(props: AppLayoutShellProps) {
    return (
        <SidebarProvider>
            <PermissionProvider>
                <InnerLayout {...props} />
            </PermissionProvider>
        </SidebarProvider>
    );
}

export default AppLayoutShell;
