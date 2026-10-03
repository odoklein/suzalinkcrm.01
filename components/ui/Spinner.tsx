import { cn } from "@/lib/utils";

/**
 * Inline loading indicator. Inherits the text colour; size follows the font size by default.
 * Pass label="" when visible text next to it already says what is loading: the
 * spinner then stays out of the accessibility tree instead of announcing twice.
 */
export function Spinner({ className, label = "Chargement" }: { className?: string; label?: string }) {
    const decorative = label === "";
    return (
        <svg
            role={decorative ? undefined : "status"}
            aria-label={decorative ? undefined : label}
            aria-hidden={decorative || undefined}
            className={cn("size-[1.1em] shrink-0 animate-spin", className)}
            viewBox="0 0 24 24"
            fill="none"
        >
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
            <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

export default Spinner;
