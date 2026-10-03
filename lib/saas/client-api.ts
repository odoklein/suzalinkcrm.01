// Browser-side fetch for /api/saas/*. Never throws: network errors come back as
// { ok: false } so every form can show a message instead of crashing.

export type SaasResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: string; code?: string; status: number; data?: unknown };

export async function saasFetch<T = unknown>(
    url: string,
    init: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<SaasResult<T>> {
    try {
        const res = await fetch(url, {
            method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
            headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            signal: init.signal,
            credentials: "same-origin",
            cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.success) return { ok: true, data: json.data as T };
        if (res.status === 401 && typeof window !== "undefined" && !url.includes("/login")) {
            const back = encodeURIComponent(window.location.pathname);
            window.location.href = `/espace/connexion?next=${back}`;
        }
        return {
            ok: false,
            error: json?.error ?? `Erreur ${res.status}`,
            code: json?.code,
            status: res.status,
            data: json?.data,
        };
    } catch (err) {
        if ((err as Error).name === "AbortError") return { ok: false, error: "Annulé", status: 0 };
        return { ok: false, error: "Connexion impossible. Vérifiez votre réseau et réessayez.", status: 0 };
    }
}

export function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
