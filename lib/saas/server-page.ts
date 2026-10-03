// Server-component helpers for /espace pages: read the customer session once,
// redirect when it's missing, and hand plain JSON to client components.

import { redirect } from "next/navigation";
import { getSaasSession } from "./session";
import { hasProductAccess, refreshAccountStatus } from "./account";

export async function requireSaasPage(path: string, opts: { productAccess?: boolean } = {}) {
    const member = await getSaasSession();
    if (!member) redirect(`/espace/connexion?next=${encodeURIComponent(path)}`);
    const account = await refreshAccountStatus(member.account);
    if (opts.productAccess && !hasProductAccess(account)) redirect("/espace/paiement");
    return { member: { ...member, account }, account };
}

/** Dates → ISO strings, so server data and API responses have the same shape on the client. */
export function toPlain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
