// ============================================
// SAAS SESSION — sign-in for self-serve customers (SaasMember).
//
// Deliberately separate from next-auth: a customer cookie can never open the
// internal CRM, and an internal session never reaches /espace. HS256 JWT in an
// httpOnly cookie, re-validated against the database on every request
// (member active + sessionVersion), so disabling a member or "log out
// everywhere" takes effect immediately.
// ============================================

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SAAS_SESSION_COOKIE = "cp_saas_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const ISSUER = "captain-prospect-saas";

function secretKey(): Uint8Array {
    const secret = process.env.SAAS_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error("SAAS_SESSION_SECRET (or NEXTAUTH_SECRET) must be set");
    // Domain-separate from next-auth so the two token types can never be swapped.
    return new TextEncoder().encode(`saas:${secret}`);
}

interface SessionClaims {
    mid: string; // member id
    aid: string; // account id
    v: number; // sessionVersion
}

export async function createSaasSession(member: { id: string; accountId: string; sessionVersion: number }) {
    const token = await new SignJWT({ mid: member.id, aid: member.accountId, v: member.sessionVersion } satisfies SessionClaims)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .sign(secretKey());

    const jar = await cookies();
    jar.set(SAAS_SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
    });
}

export async function clearSaasSession() {
    const jar = await cookies();
    jar.delete(SAAS_SESSION_COOKIE);
}

async function readClaims(): Promise<SessionClaims | null> {
    const jar = await cookies();
    const token = jar.get(SAAS_SESSION_COOKIE)?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: ["HS256"] });
        if (typeof payload.mid !== "string" || typeof payload.aid !== "string" || typeof payload.v !== "number") {
            return null;
        }
        return { mid: payload.mid, aid: payload.aid, v: payload.v };
    } catch {
        return null;
    }
}

/** The signed-in member with their account, or null. */
export async function getSaasSession() {
    const claims = await readClaims();
    if (!claims) return null;
    const member = await prisma.saasMember.findUnique({
        where: { id: claims.mid },
        include: { account: true },
    });
    if (
        !member ||
        member.accountId !== claims.aid ||
        member.status !== "ACTIVE" ||
        member.sessionVersion !== claims.v
    ) {
        return null;
    }
    return member;
}

export type SaasSessionMember = NonNullable<Awaited<ReturnType<typeof getSaasSession>>>;
