"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Lightbulb, X } from "lucide-react";
import { IconButton } from "@/components/ui";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { saasFetch } from "@/lib/saas/client-api";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
    key: string;
    title: string;
    done: boolean;
    skipped: boolean;
}

/** Onboarding checklist on the home page: collapsible, preference stored per member. */
export function ChecklistCard({ items, percent, nextKey, initiallyCollapsed }: { items: ChecklistItem[]; percent: number; nextKey: string | null; initiallyCollapsed: boolean }) {
    const [collapsed, setCollapsed] = useState(initiallyCollapsed && percent < 100);
    const toggle = () => {
        const next = !collapsed;
        setCollapsed(next);
        void saasFetch("/api/saas/preferences", { method: "PATCH", body: { checklistCollapsed: next } });
    };
    return (
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-xs" aria-labelledby="checklist-title">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <h2 id="checklist-title" className="text-[15px] font-semibold text-ink">
                        {percent === 100 ? "Configuration terminée" : "Terminez votre mise en route"}
                    </h2>
                    <p className="text-xs text-ink-3">
                        {items.filter((i) => i.done || i.skipped).length} / {items.length} étapes
                    </p>
                </div>
                <IconButton icon={ChevronDown} label={collapsed ? "Déplier la liste" : "Replier la liste"} variant="ghost" size="sm" onClick={toggle} className={cn("transition", collapsed && "-rotate-90")} />
            </div>
            <ProgressBar value={percent} max={100} className="mt-3" height="sm" tone={percent === 100 ? "success" : "primary"} />
            {!collapsed && (
                <ul className="mt-4 grid gap-1 sm:grid-cols-2">
                    {items.map((item) => (
                        <li key={item.key}>
                            <Link
                                href={`/espace/onboarding?step=${item.key}`}
                                className={cn(
                                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-2",
                                    item.done ? "text-ink-3 line-through decoration-ink-4" : item.key === nextKey ? "font-medium text-ink" : "text-ink-2"
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                                        item.done ? "border-success bg-success text-white" : item.skipped ? "border-ink-4 border-dashed" : "border-line-strong"
                                    )}
                                    aria-hidden
                                >
                                    {item.done ? "✓" : ""}
                                </span>
                                {item.title}
                                {item.skipped && <span className="ml-auto text-[11px] text-ink-4">plus tard</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {nextKey && (
                <Link href={`/espace/onboarding?step=${nextKey}`} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-link hover:underline">
                    Continuer la configuration <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            )}
        </section>
    );
}

export interface Tip {
    id: string;
    title: string;
    body: string;
    href?: string;
    cta?: string;
}

/** Contextual nudges, chosen server-side from the account state; dismissals are remembered per member. */
export function TipsList({ tips }: { tips: Tip[] }) {
    const [hidden, setHidden] = useState<string[]>([]);
    const visible = tips.filter((t) => !hidden.includes(t.id));
    if (visible.length === 0) return null;
    const dismiss = (id: string) => {
        setHidden((h) => [...h, id]);
        void saasFetch("/api/saas/preferences", { method: "PATCH", body: { dismissedTips: [id] } });
    };
    return (
        <section aria-labelledby="tips-title">
            <h2 id="tips-title" className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Lightbulb className="h-4 w-4 text-accent" aria-hidden /> Pour aller plus loin
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
                {visible.slice(0, 4).map((t) => (
                    <li key={t.id} className="relative rounded-2xl border border-line bg-surface p-4 pr-10 shadow-xs">
                        <IconButton icon={X} label="Masquer ce conseil" variant="ghost" size="xs" className="absolute right-2 top-2" onClick={() => dismiss(t.id)} />
                        <p className="text-[13.5px] font-medium text-ink">{t.title}</p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{t.body}</p>
                        {t.href && (
                            <Link href={t.href} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-link hover:underline">
                                {t.cta ?? "Voir"} <ArrowRight className="h-3 w-3" />
                            </Link>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
