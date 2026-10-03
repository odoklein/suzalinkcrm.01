import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal step indicator for short linear flows (sign-up, checkout). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
    return (
        <ol className="flex items-center gap-2" aria-label="Progression">
            {steps.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? "step" : undefined}>
                        <span
                            className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                                done && "bg-success text-white",
                                active && "bg-primary text-primary-fg",
                                !done && !active && "bg-surface-3 text-ink-3"
                            )}
                        >
                            {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                        </span>
                        <span className={cn("hidden text-[12.5px] sm:inline", active ? "font-semibold text-ink" : "text-ink-3")}>
                            {label}
                        </span>
                        {i < steps.length - 1 && <span className="h-px flex-1 bg-line" aria-hidden />}
                    </li>
                );
            })}
        </ol>
    );
}
