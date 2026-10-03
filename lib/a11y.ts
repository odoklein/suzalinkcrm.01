import type { KeyboardEvent, MouseEvent } from "react";

// ============================================
// A11Y HELPERS
// ============================================

/**
 * Props that make a non-button element (card, tile, list row) operable like a
 * button: focusable, announced as a button, activated by Enter and Space.
 *
 *   <div {...pressable(() => openClient(c))} className="… focus-visible:ring-2 focus-visible:ring-focus">
 *
 * Prefer a real <button> or <Link> when the markup allows it. Not for <tr>:
 * a row keeps its table role; give it tabIndex={0} and rowKeyDown instead.
 */
export function pressable(onActivate: (event: MouseEvent | KeyboardEvent) => void, label?: string) {
    return {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": label,
        onClick: (event: MouseEvent) => onActivate(event),
        onKeyDown: (event: KeyboardEvent) => {
            if (event.target !== event.currentTarget) return; // a control inside handles its own keys
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActivate(event);
            }
        },
    };
}

/** onKeyDown for a clickable table row: Enter (or Space) runs the row action. */
export function rowKeyDown(onActivate: () => void) {
    return (event: KeyboardEvent) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate();
        }
    };
}
