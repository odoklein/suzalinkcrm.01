"use client";

import { useState, useEffect, useLayoutEffect, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useOverlay } from "./useOverlay";

// ============================================
// TYPES
// ============================================

interface ContextMenuItem {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: "default" | "danger";
    disabled?: boolean;
    divider?: boolean;
}

interface ContextMenuProps {
    items: ContextMenuItem[];
    position: { x: number; y: number } | null;
    onClose: () => void;
}

// ============================================
// CONTEXT MENU COMPONENT
// ============================================

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
    // Joins the overlay stack: Escape closes the menu only (not a modal under
    // it), focus moves to the first item and back to the page on close.
    const menuRef = useOverlay<HTMLDivElement>({ open: !!position, onClose, lockScroll: false });
    const [mounted, setMounted] = useState(false);
    const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!position) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [position, onClose, menuRef]);

    // Keep the menu inside the viewport, measured from its real size.
    useLayoutEffect(() => {
        if (!position || !menuRef.current) {
            setPlace(null);
            return;
        }
        const { offsetWidth: w, offsetHeight: h } = menuRef.current;
        setPlace({
            left: Math.max(8, Math.min(position.x, window.innerWidth - w - 8)),
            top: Math.max(8, Math.min(position.y, window.innerHeight - h - 8)),
        });
    }, [position, items.length, menuRef]);

    if (!mounted || !position) return null;

    // Arrow keys move between enabled items (WAI-ARIA menu pattern).
    const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const buttons = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [],
        );
        if (buttons.length === 0) return;
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next =
            e.key === "Home" ? 0
            : e.key === "End" ? buttons.length - 1
            : (at + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
    };

    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="fixed z-[130] min-w-[180px] rounded-panel border border-line bg-surface py-1 shadow-overlay outline-none animate-in fade-in zoom-in-95 duration-100"
            style={place ?? { left: position.x, top: position.y }}
        >
            {items.map((item, index) => (
                <div key={index} role="none">
                    {item.divider && index > 0 && <div role="separator" className="my-1 h-px bg-line-subtle" />}
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            if (!item.disabled) {
                                item.onClick();
                                onClose();
                            }
                        }}
                        disabled={item.disabled}
                        className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors outline-none [&_svg]:size-4 [&_svg]:shrink-0",
                            item.disabled
                                ? "cursor-not-allowed text-ink-4"
                                : item.variant === "danger"
                                    ? "text-danger-ink hover:bg-danger-soft focus-visible:bg-danger-soft"
                                    : "text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2 focus-visible:text-ink",
                        )}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                </div>
            ))}
        </div>,
        document.body
    );
}

// ============================================
// HOOK FOR CONTEXT MENU
// ============================================

export function useContextMenu() {
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [contextData, setContextData] = useState<any>(null);

    const handleContextMenu = (e: React.MouseEvent, data?: any) => {
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setContextData(data);
    };

    const close = () => {
        setPosition(null);
        setContextData(null);
    };

    return {
        position,
        contextData,
        handleContextMenu,
        close,
    };
}
