"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Bell, Check, Info, AlertTriangle, XCircle, CheckCircle2,
    ChevronRight, Settings, CheckCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { pressable } from "@/lib/a11y";
import { FOCUS_RING } from "./recipes";
import { useOverlay } from "./useOverlay";

// Poll less often and only when tab is visible to reduce /api/notifications load
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes (was 1 min)

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
    link: string | null;
    isRead: boolean;
    createdAt: string;
}

const TYPE_CONFIG = {
    success: {
        icon: CheckCircle2,
        bg: "bg-success-soft",
        iconColor: "text-success",
        dot: "bg-success",
        border: "border-success-line",
    },
    warning: {
        icon: AlertTriangle,
        bg: "bg-warning-soft",
        iconColor: "text-warning",
        dot: "bg-warning",
        border: "border-warning-line",
    },
    error: {
        icon: XCircle,
        bg: "bg-danger-soft",
        iconColor: "text-danger",
        dot: "bg-danger",
        border: "border-danger-line",
    },
    info: {
        icon: Info,
        bg: "bg-info-soft",
        iconColor: "text-info",
        dot: "bg-info",
        border: "border-info-line",
    },
};

export function NotificationBell() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
    const [justMarkedAll, setJustMarkedAll] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    useOverlay({ open: isOpen, onClose: () => setIsOpen(false), lockScroll: false, trapFocus: false });

    // Only these roles have a notifications page; the others (developer,
    // commercial) were sent to a 404 or bounced to /unauthorized.
    const getNotificationsPageUrl = (): string | null => {
        const role = session?.user?.role;
        if (role === "CLIENT") return "/client/portal/notifications";
        if (role === "SDR" || role === "BUSINESS_DEVELOPER" || role === "BOOKER") return "/sdr/notifications";
        if (role === "MANAGER") return "/manager/notifications";
        return null;
    };
    const notificationsPageUrl = getNotificationsPageUrl();

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications");
            const json = await res.json();
            if (json.success) {
                setNotifications(json.data.notifications);
                setUnreadCount(json.data.unreadCount);
            }
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    }, []);

    // Initial load + poll only when tab is visible (reduces requests in background tabs)
    useEffect(() => {
        loadNotifications();

        let intervalId: ReturnType<typeof setInterval> | null = null;
        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };
        const startPolling = () => {
            stopPolling();
            intervalId = setInterval(loadNotifications, POLL_INTERVAL_MS);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                loadNotifications();
                startPolling();
            } else {
                stopPolling();
            }
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        if (document.visibilityState === "visible") {
            startPolling();
        }

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            stopPolling();
        };
    }, [loadNotifications]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string, link: string | null) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: "PATCH" });
            setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            if (link) { setIsOpen(false); router.push(link); }
        } catch (error) { console.error("Failed to mark as read", error); }
    };

    const markAllAsRead = async () => {
        try {
            await fetch("/api/notifications", { method: "PATCH" });
            setNotifications(notifications.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            setJustMarkedAll(true);
            setTimeout(() => setJustMarkedAll(false), 2000);
        } catch (error) { console.error("Failed to mark all as read", error); }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return "À l'instant";
        if (diffMins < 60) return `il y a ${diffMins}min`;
        if (diffHours < 24) return `il y a ${diffHours}h`;
        if (diffDays < 7) return `il y a ${diffDays}j`;
        return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    };

    const displayed = (activeTab === "unread"
        ? notifications.filter(n => !n.isRead)
        : notifications
    ).slice(0, 6);

    return (
        <>
            <style>{`
                @keyframes bellWiggle {
                    0%, 100% { transform: rotate(0deg); }
                    15%       { transform: rotate(12deg); }
                    30%       { transform: rotate(-10deg); }
                    45%       { transform: rotate(6deg); }
                    60%       { transform: rotate(-4deg); }
                    75%       { transform: rotate(2deg); }
                }
                @keyframes notifDrop {
                    from { opacity:0; transform: translateY(-10px) scale(0.97); }
                    to   { opacity:1; transform: translateY(0) scale(1); }
                }
                @keyframes notifItemIn {
                    from { opacity:0; transform: translateX(-8px); }
                    to   { opacity:1; transform: translateX(0); }
                }
                @keyframes badgePop {
                    0%   { transform: scale(0); }
                    70%  { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
                .bell-animate { animation: bellWiggle 0.5s ease; }
            `}</style>

            <div className="relative" ref={containerRef}>
                {/* ── Bell Button ── */}
                <button
                    id="notification-bell-btn"
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={isOpen}
                    onClick={() => {
                        const next = !isOpen;
                        setIsOpen(next);
                        if (next) loadNotifications();
                    }}
                    className={cn(
                        "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200",
                        "border",
                        FOCUS_RING,
                        isOpen
                            ? "bg-accent-100 border-accent-200 text-accent-600 shadow-sm"
                            : "bg-surface border-line text-ink-3 hover:border-accent-200 hover:text-accent-600 hover:bg-accent-50 hover:shadow-sm"
                    )}
                    aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Notifications"}
                >
                    <Bell className={cn("w-4 h-4 transition-transform duration-200", isOpen && "scale-90")} aria-hidden />

                    {/* Unread badge */}
                    {unreadCount > 0 && (
                        <span aria-hidden className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-3xs font-black text-white leading-none tabular-nums"
                            style={{
                                background: "var(--ds-danger)",
                                animation: "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                                boxShadow: "0 0 0 2px var(--ds-surface)",
                            }}>
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </button>

                {/* ── Dropdown Panel ── */}
                {isOpen && (
                    <div
                        role="dialog"
                        aria-label="Notifications"
                        className="absolute right-0 mt-2.5 w-[380px] max-w-[calc(100vw-1.5rem)] z-50 overflow-hidden rounded-[20px] border border-line bg-surface shadow-overlay"
                        style={{
                            animation: "notifDrop 0.22s cubic-bezier(0.22,1,0.36,1)",
                        }}
                    >
                        {/* ── Header ── */}
                        <div className="px-4 pt-4 pb-3 border-b border-line-subtle">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-accent-100 flex items-center justify-center">
                                        <Bell className="w-3.5 h-3.5 text-accent-600" aria-hidden />
                                    </div>
                                    <span className="font-bold text-[15px] text-ink">Notifications</span>
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-accent-100 text-accent-700">
                                            {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {unreadCount > 0 && (
                                        <button type="button" onClick={markAllAsRead}
                                            className={cn(
                                                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200",
                                                FOCUS_RING,
                                                justMarkedAll
                                                    ? "bg-success-soft text-success-ink"
                                                    : "text-accent-600 hover:bg-accent-50"
                                            )}>
                                            {justMarkedAll ? <Check className="w-3 h-3" aria-hidden /> : <CheckCheck className="w-3 h-3" aria-hidden />}
                                            {justMarkedAll ? "Fait" : "Tout lire"}
                                        </button>
                                    )}
                                    {notificationsPageUrl && (
                                        <Link href={notificationsPageUrl}
                                            onClick={() => setIsOpen(false)}
                                            aria-label="Gérer les notifications"
                                            title="Gérer les notifications"
                                            className={cn("w-7 h-7 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 flex items-center justify-center transition-colors duration-150", FOCUS_RING)}>
                                            <Settings className="w-3.5 h-3.5" aria-hidden />
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div role="tablist" aria-label="Filtrer les notifications" className="flex gap-1 p-1 bg-surface-3 rounded-xl">
                                {(["all", "unread"] as const).map((tab) => (
                                    <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-150",
                                            FOCUS_RING,
                                            "focus-visible:ring-offset-surface-3",
                                            activeTab === tab
                                                ? "bg-surface text-ink shadow-sm"
                                                : "text-ink-3 hover:text-ink"
                                        )}>
                                        {tab === "all" ? "Toutes" : (
                                            <span className="flex items-center justify-center gap-1">
                                                Non lues
                                                {unreadCount > 0 && (
                                                    <span className="w-4 h-4 rounded-full bg-danger text-white text-3xs flex items-center justify-center font-black tabular-nums">
                                                        {unreadCount > 9 ? "9+" : unreadCount}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Notification List ── */}
                        <div className="overflow-y-auto max-h-[380px]"
                            style={{ scrollbarWidth: "thin", scrollbarColor: "var(--ds-line) transparent" }}>
                            {displayed.length === 0 ? (
                                <div className="py-10 px-6 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-line-subtle flex items-center justify-center mx-auto mb-3">
                                        <Bell className="w-7 h-7 text-ink-4" aria-hidden />
                                    </div>
                                    <p className="text-[13px] font-semibold text-ink-2 mb-1">
                                        {activeTab === "unread" ? "Tout est lu" : "Aucune notification"}
                                    </p>
                                    <p className="text-[11px] text-ink-3">
                                        {activeTab === "unread"
                                            ? "Vous avez lu toutes vos notifications."
                                            : "Les nouvelles notifications apparaîtront ici."}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    {displayed.map((n, idx) => {
                                        const cfg = TYPE_CONFIG[n.type];
                                        const Icon = cfg.icon;
                                        return (
                                            <div
                                                key={n.id}
                                                {...pressable(() => markAsRead(n.id, n.link))}
                                                className={cn(
                                                    "relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 group border-b border-line-subtle last:border-0 outline-none focus-visible:bg-accent-50 focus-visible:shadow-[inset_3px_0_0_var(--ds-accent)]",
                                                    !n.isRead
                                                        ? "bg-accent-50/40 hover:bg-accent-50/70"
                                                        : "hover:bg-surface-2/80"
                                                )}
                                                style={{
                                                    animation: `notifItemIn 0.25s ease ${idx * 0.04}s both`,
                                                }}
                                            >
                                                {/* Unread stripe */}
                                                {!n.isRead && (
                                                    <div aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-accent-500" />
                                                )}

                                                {/* Icon */}
                                                <div className={cn(
                                                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border",
                                                    cfg.bg, cfg.border
                                                )}>
                                                    <Icon className={cn("w-4 h-4", cfg.iconColor)} aria-hidden />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <p className={cn(
                                                            "text-[12px] leading-snug line-clamp-1",
                                                            !n.isRead ? "font-bold text-ink" : "font-semibold text-ink-2"
                                                        )}>
                                                            {n.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                                            {!n.isRead && (
                                                                <>
                                                                    <div aria-hidden className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                                                                    <span className="sr-only">Non lue,</span>
                                                                </>
                                                            )}
                                                            <span className="text-3xs text-ink-3 whitespace-nowrap">{formatDate(n.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-ink-3 mt-0.5 line-clamp-2 leading-relaxed">
                                                        {n.message}
                                                    </p>
                                                </div>

                                                {/* Arrow */}
                                                {n.link && (
                                                    <ChevronRight aria-hidden className="w-3.5 h-3.5 text-ink-4 group-hover:text-accent-500 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0 mt-1" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Footer ── */}
                        {notificationsPageUrl && (
                        <div className="px-4 py-3 border-t border-line-subtle bg-surface-2">
                            <Link
                                href={notificationsPageUrl}
                                onClick={() => setIsOpen(false)}
                                className={cn("flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-[12px] font-bold text-accent-600 hover:text-accent-800 hover:bg-accent-50 transition-all duration-150 group", FOCUS_RING, "focus-visible:ring-offset-surface-2")}
                            >
                                <span>Voir toutes les notifications</span>
                                <ChevronRight aria-hidden className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                            </Link>
                        </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
