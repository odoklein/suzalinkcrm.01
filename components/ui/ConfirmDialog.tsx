"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "./Button";
import { Modal, ModalFooter } from "./Modal";
import Input from "./Input";

// ============================================
// CONFIRM / PROMPT — the design-system replacement for window.confirm,
// window.prompt and window.alert. Promise-based, so a native call converts
// in place:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Supprimer la liste ?", variant: "danger" }))) return;
//
//   const prompt = usePrompt();
//   const reason = await prompt({ title: "Raison de l'annulation", required: true });
//   if (reason === null) return;           // cancelled
// ============================================

type Variant = "default" | "warning" | "danger";

export interface ConfirmOptions {
    title: string;
    message?: ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: Variant;
}

export interface PromptOptions extends ConfirmOptions {
    label?: string;
    placeholder?: string;
    defaultValue?: string;
    /** Disable confirm while the field is empty. */
    required?: boolean;
    multiline?: boolean;
}

type Request =
    | { kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
    | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

interface DialogsContextValue {
    confirm: (options: ConfirmOptions) => Promise<boolean>;
    prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
    const [request, setRequest] = useState<Request | null>(null);
    const [value, setValue] = useState("");
    // Resolve each request exactly once, whichever way it closes.
    const settled = useRef(false);

    const confirm = useCallback(
        (options: ConfirmOptions) =>
            new Promise<boolean>((resolve) => {
                settled.current = false;
                setRequest({ kind: "confirm", options, resolve });
            }),
        [],
    );

    const prompt = useCallback(
        (options: PromptOptions) =>
            new Promise<string | null>((resolve) => {
                settled.current = false;
                setValue(options.defaultValue ?? "");
                setRequest({ kind: "prompt", options, resolve });
            }),
        [],
    );

    const finish = (ok: boolean) => {
        if (!request || settled.current) return;
        settled.current = true;
        if (request.kind === "confirm") request.resolve(ok);
        else request.resolve(ok ? value : null);
        setRequest(null);
    };

    const options = request?.options;
    const variant = options?.variant ?? "default";
    const Icon = variant === "danger" ? OctagonAlert : variant === "warning" ? AlertTriangle : null;
    const blocked = request?.kind === "prompt" && request.options.required && value.trim() === "";

    return (
        <DialogsContext.Provider value={{ confirm, prompt }}>
            {children}
            <Modal isOpen={!!request} onClose={() => finish(false)} title={options?.title} size="sm">
                {options && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (!blocked) finish(true);
                        }}
                    >
                        {options.message && (
                            <div className="flex items-start gap-3.5">
                                {Icon && (
                                    <span
                                        className={cn(
                                            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl border",
                                            variant === "danger"
                                                ? "border-danger-line bg-danger-soft text-danger"
                                                : "border-warning-line bg-warning-soft text-warning",
                                        )}
                                    >
                                        <Icon className="size-5" aria-hidden />
                                    </span>
                                )}
                                <div className="pt-0.5 text-sm leading-relaxed text-ink-2">{options.message}</div>
                            </div>
                        )}
                        {request?.kind === "prompt" && (
                            <div className={cn(options.message && "mt-4")}>
                                {request.options.multiline ? (
                                    <textarea
                                        aria-label={request.options.label ?? options.title}
                                        className="min-h-24 w-full resize-y rounded-control border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-2xs placeholder:text-ink-4 focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-500/12"
                                        placeholder={request.options.placeholder}
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        autoFocus
                                    />
                                ) : (
                                    <Input
                                        label={request.options.label}
                                        aria-label={request.options.label ? undefined : options.title}
                                        placeholder={request.options.placeholder}
                                        value={value}
                                        onChange={(e) => setValue(e.target.value)}
                                        autoFocus
                                    />
                                )}
                            </div>
                        )}
                        <ModalFooter>
                            <Button type="button" variant="ghost" onClick={() => finish(false)}>
                                {options.cancelText ?? "Annuler"}
                            </Button>
                            <Button
                                type="submit"
                                variant={variant === "danger" ? "danger" : "primary"}
                                disabled={blocked}
                                className={variant === "warning" ? "bg-warning shadow-xs hover:bg-warning-ink" : undefined}
                            >
                                {options.confirmText ?? (variant === "danger" ? "Supprimer" : "Confirmer")}
                            </Button>
                        </ModalFooter>
                    </form>
                )}
            </Modal>
        </DialogsContext.Provider>
    );
}

function useDialogs(): DialogsContextValue {
    const ctx = useContext(DialogsContext);
    if (!ctx) throw new Error("useConfirm/usePrompt must be used inside <ConfirmDialogProvider>");
    return ctx;
}

/** `await confirm({...})` → true when confirmed. Replaces window.confirm. */
export function useConfirm() {
    return useDialogs().confirm;
}

/** `await prompt({...})` → the text, or null when cancelled. Replaces window.prompt. */
export function usePrompt() {
    return useDialogs().prompt;
}
