/**
 * Extract client IP from request headers (supports proxy/load balancer).
 */
export function getClientIp(req: { headers?: Headers | Record<string, string | string[] | undefined> }): string | null {
    if (!req?.headers) return null;
    const headers = req.headers as Headers;
    const get = (name: string) => {
        if (typeof headers.get === "function") return headers.get(name);
        const h = headers as unknown as Record<string, string | string[] | undefined>;
        const v = h[name.toLowerCase()] ?? h[name];
        return Array.isArray(v) ? v[0] : v ?? null;
    };
    const forwarded = get("x-forwarded-for") || get("x-real-ip");
    if (forwarded) {
        const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : String(forwarded).split(",")[0].trim();
        return ip || null;
    }
    return null;
}

/**
 * Resolve country from IP using ip-api.com (free, no key required).
 * Returns null on failure or for localhost.
 */
export async function getCountryFromIp(ip: string | null): Promise<string | null> {
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
        return null;
    }
    try {
        const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country`, {
            signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        if (data?.status === "success" && data?.country) return data.country;
    } catch {
        // Ignore geo lookup failures
    }
    return null;
}
