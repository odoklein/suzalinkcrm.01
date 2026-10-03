"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { HealthPulse } from "@/components/email/dashboard/HealthPulse";
import { SequencePerformancePanel } from "@/components/email/dashboard/SequencePerformancePanel";
import { ActivityFeed } from "@/components/email/dashboard/ActivityFeed";
import { MailboxHealthGrid } from "@/components/email/dashboard/MailboxHealthGrid";
import { PendingActions } from "@/components/email/dashboard/PendingActions";

// ============================================
// EMAIL HUB DASHBOARD — Landing Page
// /manager/emails
//
// three horizontal zones:
//   A: Health pulse strip (top)
//   B: Three panels side by side (middle)
//   C: Pending actions (bottom)
// ============================================

// Types from the APIs
interface HealthData {
    activeMailboxes: number;
    warmingMailboxes: number;
    sentToday: number;
    openRate: number;
    activeSequences: number;
    errorMailboxes: number;
}

interface SequencePerf {
    id: string;
    name: string;
    status: "ACTIVE" | "PAUSED" | "DRAFT" | "ARCHIVED";
    mission: { id: string; name: string } | null;
    enrolled: number;
    openRate: number;
    replyRate: number;
    stepsCount: number;
    sparkline: number[];
}

interface ActivityEvent {
    id: string;
    type: "sent" | "opened" | "replied" | "clicked" | "bounced" | "sequence_step";
    timestamp: string;
    contactName: string | null;
    companyName: string | null;
    contactId: string | null;
    threadId: string | null;
    subject: string;
    missionName: string | null;
    sequenceName: string | null;
    mailboxEmail: string | null;
    openCount?: number;
    meta?: string;
}

interface PendingAction {
    id: string;
    type: "reply" | "bounce" | "review" | "limit";
    priority: number;
    title: string;
    description: string;
    missionName: string | null;
    linkHref: string;
    linkLabel: string;
    count?: number;
    meta?: Record<string, unknown>;
}

interface MailboxHealth {
    id: string;
    email: string;
    displayName: string | null;
    provider: string;
    syncStatus: string;
    warmupStatus: string;
    warmupDailyLimit: number;
    dailySendLimit: number;
    sentToday: number;
    healthScore: number;
    isActive: boolean;
    disabledAt: string | null;
    lastError: string | null;
}

export default function EmailDashboardPage() {
    const router = useRouter();

    // State for each zone
    const [health, setHealth] = useState<HealthData | null>(null);
    const [healthLoading, setHealthLoading] = useState(true);

    const [sequences, setSequences] = useState<SequencePerf[] | null>(null);
    const [seqLoading, setSeqLoading] = useState(true);

    const [activity, setActivity] = useState<ActivityEvent[] | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const [mailboxes, setMailboxes] = useState<MailboxHealth[] | null>(null);
    const [mbLoading, setMbLoading] = useState(true);

    const [actions, setActions] = useState<PendingAction[] | null>(null);
    const [actionsLoading, setActionsLoading] = useState(true);

    // ── Fetch functions ──

    const fetchHealth = useCallback(async () => {
        try {
            const res = await fetch("/api/email/dashboard/health");
            const json = await res.json();
            if (json.success) setHealth(json.data);
        } catch (e) {
            console.error("Failed to fetch health:", e);
        } finally {
            setHealthLoading(false);
        }
    }, []);

    const fetchSequences = useCallback(async () => {
        try {
            const res = await fetch("/api/email/dashboard/sequences");
            const json = await res.json();
            if (json.success) setSequences(json.data);
        } catch (e) {
            console.error("Failed to fetch sequences:", e);
        } finally {
            setSeqLoading(false);
        }
    }, []);

    const fetchActivity = useCallback(async () => {
        setActivityLoading(true);
        try {
            const res = await fetch("/api/email/dashboard/activity?limit=20");
            const json = await res.json();
            if (json.success) setActivity(json.data);
        } catch (e) {
            console.error("Failed to fetch activity:", e);
        } finally {
            setActivityLoading(false);
            setLastRefresh(new Date());
        }
    }, []);

    const fetchMailboxes = useCallback(async () => {
        try {
            const res = await fetch("/api/email/mailboxes");
            const json = await res.json();
            if (json.success) {
                setMailboxes(json.data);
            } else if (Array.isArray(json)) {
                setMailboxes(json);
            }
        } catch (e) {
            console.error("Failed to fetch mailboxes:", e);
        } finally {
            setMbLoading(false);
        }
    }, []);

    const fetchActions = useCallback(async () => {
        try {
            const res = await fetch("/api/email/dashboard/actions");
            const json = await res.json();
            if (json.success) setActions(json.data);
        } catch (e) {
            console.error("Failed to fetch actions:", e);
        } finally {
            setActionsLoading(false);
        }
    }, []);

    // ── Initial load ──
    useEffect(() => {
        fetchHealth();
        fetchSequences();
        fetchActivity();
        fetchMailboxes();
        fetchActions();
    }, [fetchHealth, fetchSequences, fetchActivity, fetchMailboxes, fetchActions]);

    // ── Handlers ──

    const handleNavigate = (tab: string) => {
        router.push(`/manager/emails/${tab}`);
    };

    const handleSequenceToggle = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/email/sequences/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setSequences((prev) =>
                    prev?.map((s) =>
                        s.id === id
                            ? { ...s, status: newStatus as SequencePerf["status"] }
                            : s
                    ) || null
                );
            }
        } catch (e) {
            console.error("Failed to toggle sequence:", e);
        }
    };

    const handleSequenceClick = (sequenceId: string) => {
        router.push(`/manager/emails/sequences/${sequenceId}`);
    };

    const handleMailboxClick = (mailboxId: string) => {
        router.push(`/manager/emails/mailboxes?selected=${mailboxId}`);
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* ── ZONE A: Health Pulse Strip ── */}
            <HealthPulse
                data={health}
                isLoading={healthLoading}
                onNavigate={handleNavigate}
            />

            {/* ── ZONE B: Three Panels ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Panel 1: Sequence Performance */}
                <SequencePerformancePanel
                    data={sequences}
                    isLoading={seqLoading}
                    onToggleStatus={handleSequenceToggle}
                    onNavigate={handleSequenceClick}
                />

                {/* Panel 2: Activity Feed */}
                <ActivityFeed
                    data={activity}
                    isLoading={activityLoading}
                    onRefresh={fetchActivity}
                    lastRefreshAt={lastRefresh}
                />

                {/* Panel 3: Mailbox Health Grid */}
                <MailboxHealthGrid
                    data={mailboxes}
                    isLoading={mbLoading}
                    onMailboxClick={handleMailboxClick}
                />
            </div>

            {/* ── ZONE C: Pending Actions ── */}
            <PendingActions
                data={actions}
                isLoading={actionsLoading}
            />
        </div>
    );
}
