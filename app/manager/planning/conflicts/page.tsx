'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, RefreshCw, ArrowLeft, Filter } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────
interface PlanningConflict {
    id: string;
    type: string;
    severity: 'P0' | 'P1' | 'P2';
    sdrId: string | null;
    missionId: string | null;
    month: string;
    message: string;
    suggestedAction: string | null;
    resolvedAt: string | null;
    createdAt: string;
}

interface ConflictSummary {
    P0: number;
    P1: number;
    P2: number;
    total: number;
}

const SEVERITY_CONFIG = {
    P0: {
        label: 'Critiques',
        dot: 'bg-red-500',
        badge: 'bg-red-100 text-red-800 border-red-200',
        header: 'border-l-4 border-red-500',
        ring: 'ring-red-200',
    },
    P1: {
        label: 'Avertissements',
        dot: 'bg-amber-500',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        header: 'border-l-4 border-amber-500',
        ring: 'ring-amber-200',
    },
    P2: {
        label: 'Informations',
        dot: 'bg-blue-500',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        header: 'border-l-4 border-blue-500',
        ring: 'ring-blue-200',
    },
} as const;

const TYPE_LABELS: Record<string, string> = {
    SDR_OVERLOADED_MONTH: 'SDR surchargé',
    SDR_DOUBLE_BOOKED_DAY: 'Double réservation',
    MISSION_NO_SDR: 'Mission sans SDR',
    MISSION_UNDERSTAFFED: 'Mission sous-staffée',
    MISSION_OVERSTAFFED: 'Mission sur-staffée',
    SDR_NEAR_CAPACITY: 'SDR proche de la capacité',
    ALLOCATION_NOT_SCHEDULED: 'Allocation non planifiée',
    ABSENCE_CONFLICTS_BLOCK: 'Bloc sur jour d\'absence',
    CONTRACT_NOT_FULLY_PLANNED: 'Contrat incomplet',
    MISSION_ENDING_UNPLANNED: 'Mission se terminant bientôt',
    NO_PLAN_FOR_ACTIVE_MONTH: 'Mois non planifié',
    SDR_UNDERUTILIZED: 'SDR sous-utilisé',
};

// ── Component ──────────────────────────────────────────────────────────
export default function PlanningConflictsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const monthParam = searchParams.get('month') ?? formatMonth(new Date());
    const [month, setMonth] = useState(monthParam);
    const [conflicts, setConflicts] = useState<PlanningConflict[]>([]);
    const [summary, setSummary] = useState<ConflictSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const [filter, setFilter] = useState<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/planning/conflicts?month=${month}`);
            const json = await res.json();
            if (json.success) {
                setConflicts(json.data.conflicts);
                setSummary(json.data.summary);
            }
        } finally {
            setLoading(false);
        }
    }, [month]);

    useEffect(() => { load(); }, [load]);

    async function resolveConflict(id: string) {
        setResolving(id);
        try {
            await fetch(`/api/planning/conflicts?id=${id}`, { method: 'PATCH' });
            setConflicts((prev) => prev.filter((c) => c.id !== id));
            setSummary((prev) => prev ? { ...prev, total: prev.total - 1 } : prev);
        } finally {
            setResolving(null);
        }
    }

    const filtered = filter === 'ALL' ? conflicts : conflicts.filter((c) => c.severity === filter);
    const grouped = {
        P0: filtered.filter((c) => c.severity === 'P0'),
        P1: filtered.filter((c) => c.severity === 'P1'),
        P2: filtered.filter((c) => c.severity === 'P2'),
    };

    const prevMonth = () => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        setMonth(formatMonth(d));
    };
    const nextMonth = () => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m, 1);
        setMonth(formatMonth(d));
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="sm" onClick={() => router.back()}>
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Retour
                            </Button>
                            <div className="h-5 w-px bg-gray-200" />
                            <h1 className="text-lg font-semibold text-gray-900">Conflits de planning</h1>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Month selector */}
                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-3 py-1.5">
                                <button onClick={prevMonth} className="text-gray-400 hover:text-gray-700 text-sm px-1">‹</button>
                                <span className="text-sm font-medium text-gray-800 min-w-[110px] text-center capitalize">
                                    {formatMonthLabel(month)}
                                </span>
                                <button onClick={nextMonth} className="text-gray-400 hover:text-gray-700 text-sm px-1">›</button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                            </Button>
                        </div>
                    </div>

                    {/* Summary pills */}
                    {summary && (
                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-sm text-gray-500">{summary.total} conflit{summary.total !== 1 ? 's' : ''}</span>
                            {(['P0', 'P1', 'P2'] as const).map((sev) => (
                                <button
                                    key={sev}
                                    onClick={() => setFilter(filter === sev ? 'ALL' : sev)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                                        SEVERITY_CONFIG[sev].badge,
                                        filter === sev && 'ring-2 ' + SEVERITY_CONFIG[sev].ring
                                    )}
                                >
                                    <span className={cn('w-1.5 h-1.5 rounded-full', SEVERITY_CONFIG[sev].dot)} />
                                    {summary[sev]} {SEVERITY_CONFIG[sev].label}
                                </button>
                            ))}
                            {filter !== 'ALL' && (
                                <button onClick={() => setFilter('ALL')} className="text-xs text-gray-500 underline">
                                    Tout afficher
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : conflicts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                        <h2 className="text-lg font-semibold text-gray-800">Aucun conflit ce mois</h2>
                        <p className="text-sm text-gray-500 mt-1">Le planning de {formatMonthLabel(month)} est sain.</p>
                    </div>
                ) : (
                    (['P0', 'P1', 'P2'] as const).map((sev) => {
                        const items = grouped[sev];
                        if (items.length === 0) return null;
                        const cfg = SEVERITY_CONFIG[sev];
                        return (
                            <section key={sev}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                        {cfg.label} ({items.length})
                                    </h2>
                                </div>
                                <div className="space-y-3">
                                    {items.map((conflict) => (
                                        <ConflictCard
                                            key={conflict.id}
                                            conflict={conflict}
                                            onResolve={resolveConflict}
                                            resolving={resolving === conflict.id}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ── ConflictCard ───────────────────────────────────────────────────────
function ConflictCard({
    conflict,
    onResolve,
    resolving,
}: {
    conflict: PlanningConflict;
    onResolve: (id: string) => void;
    resolving: boolean;
}) {
    const cfg = SEVERITY_CONFIG[conflict.severity];

    return (
        <div className={cn(
            'bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4 shadow-sm',
            cfg.header
        )}>
            <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0', cfg.dot)} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', cfg.badge)}>
                        {TYPE_LABELS[conflict.type] ?? conflict.type}
                    </span>
                    <span className="text-xs text-gray-400">{formatMonthLabel(conflict.month)}</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{conflict.message}</p>
                {conflict.suggestedAction && (
                    <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                        <span className="text-blue-400 mt-0.5">→</span>
                        {conflict.suggestedAction}
                    </p>
                )}
            </div>
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onResolve(conflict.id)}
                disabled={resolving}
                className="flex-shrink-0 text-xs text-gray-500 hover:text-green-600"
            >
                {resolving ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                    <CheckCircle2 className="w-4 h-4" />
                )}
            </Button>
        </div>
    );
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
