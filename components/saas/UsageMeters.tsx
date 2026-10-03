import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatQuota } from "@/lib/saas/plans";

interface Meter {
    label: string;
    used: number;
    limit: number | null;
    unit?: string;
    note?: string;
}

export function UsageMeters({ meters }: { meters: Meter[] }) {
    return (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meters.map((m) => {
                const ratio = m.limit ? m.used / m.limit : 0;
                const tone = ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "primary";
                return (
                    <li key={m.label} className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
                        <p className="text-xs text-ink-3">{m.label}</p>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                            {m.used.toLocaleString("fr-FR")}
                            <span className="text-[13px] font-normal text-ink-3"> / {formatQuota(m.limit, m.unit)}</span>
                        </p>
                        {m.limit !== null && <ProgressBar value={Math.min(m.used, m.limit)} max={m.limit} height="sm" tone={tone} className="mt-2" />}
                        {m.note && <p className="mt-1.5 text-[11.5px] text-ink-4">{m.note}</p>}
                    </li>
                );
            })}
        </ul>
    );
}
