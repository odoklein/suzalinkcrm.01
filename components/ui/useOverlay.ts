"use client";

import { useEffect, useId, useRef } from "react";

// ============================================
// OVERLAY LAYER — one stack for every dismissible layer (modal, drawer,
// menu, popover). Fixes what each layer listening on `document` by itself
// got wrong once two were open at the same time:
//   · Escape closes the top layer only (a menu inside a modal, a confirm
//     opened from a drawer), never everything underneath it.
//   · Scroll lock is counted: closing the inner layer no longer unlocks the
//     page while the outer one is still open.
//   · Tab cycles inside the top layer when it traps focus, and focus goes
//     back to the control that opened it.
//
//   const panelRef = useOverlay<HTMLDivElement>({ open, onClose });
//   <div ref={panelRef} role="dialog" aria-modal="true" tabIndex={-1}>…
//
// A control inside a layer that handles Escape itself (an open listbox)
// calls e.preventDefault(); the layer then leaves the key alone.
// ============================================

interface OverlayOptions {
    open: boolean;
    onClose: () => void;
    /** Escape closes this layer when it is on top. */
    closeOnEscape?: boolean;
    /** Lock page scroll while open (modals, modal drawers). */
    lockScroll?: boolean;
    /** Move focus in on open, keep Tab inside, restore focus on close. */
    trapFocus?: boolean;
}

interface Layer {
    id: string;
    closeOnEscape: () => boolean;
    trapFocus: () => boolean;
    close: () => void;
    node: () => HTMLElement | null;
}

const FOCUSABLE =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

const stack: Layer[] = [];
let listening = false;

function focusables(node: HTMLElement): HTMLElement[] {
    return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
    );
}

function onDocumentKeyDown(e: KeyboardEvent) {
    const top = stack[stack.length - 1];
    if (!top) return;

    if (e.key === "Escape") {
        if (e.defaultPrevented || !top.closeOnEscape()) return;
        e.preventDefault();
        top.close();
        return;
    }

    if (e.key === "Tab" && top.trapFocus()) {
        const node = top.node();
        if (!node) return;
        const items = focusables(node);
        if (items.length === 0) {
            e.preventDefault();
            node.focus();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        const outside = !active || !node.contains(active);
        if (e.shiftKey && (active === first || outside)) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (active === last || outside)) {
            e.preventDefault();
            first.focus();
        }
    }
}

function push(layer: Layer) {
    stack.push(layer);
    if (!listening) {
        document.addEventListener("keydown", onDocumentKeyDown);
        listening = true;
    }
}

function remove(id: string) {
    const at = stack.findIndex((l) => l.id === id);
    if (at !== -1) stack.splice(at, 1);
    if (stack.length === 0 && listening) {
        document.removeEventListener("keydown", onDocumentKeyDown);
        listening = false;
    }
}

let scrollLocks = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockScroll() {
    if (scrollLocks++ > 0) return;
    const body = document.body;
    savedOverflow = body.style.overflow;
    savedPaddingRight = body.style.paddingRight;
    // Keep the page from shifting when its scrollbar disappears.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    body.style.overflow = "hidden";
}

function unlockScroll() {
    if (scrollLocks === 0 || --scrollLocks > 0) return;
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
}

/** True when the layer is the top-most open overlay. */
export function isTopOverlay(node: HTMLElement | null): boolean {
    const top = stack[stack.length - 1];
    return !!node && !!top && top.node() === node;
}

export function useOverlay<T extends HTMLElement = HTMLDivElement>({
    open,
    onClose,
    closeOnEscape = true,
    lockScroll: shouldLock = true,
    trapFocus = true,
}: OverlayOptions) {
    const id = useId();
    const ref = useRef<T>(null);
    // Latest values without re-registering the layer on every render.
    const latest = useRef({ onClose, closeOnEscape, trapFocus });
    latest.current = { onClose, closeOnEscape, trapFocus };

    useEffect(() => {
        if (!open) return;
        push({
            id,
            close: () => latest.current.onClose(),
            closeOnEscape: () => latest.current.closeOnEscape,
            trapFocus: () => latest.current.trapFocus,
            node: () => ref.current,
        });
        if (shouldLock) lockScroll();
        return () => {
            remove(id);
            if (shouldLock) unlockScroll();
        };
    }, [open, id, shouldLock]);

    // Focus in on open (unless something inside already took it, e.g.
    // autoFocus), back to the opener on close.
    useEffect(() => {
        if (!open || !trapFocus) return;
        const opener = document.activeElement as HTMLElement | null;
        const node = ref.current;
        if (node && !node.contains(document.activeElement)) {
            const first = focusables(node)[0];
            (first ?? node).focus({ preventScroll: true });
        }
        return () => {
            if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        };
    }, [open, trapFocus]);

    return ref;
}

export default useOverlay;
