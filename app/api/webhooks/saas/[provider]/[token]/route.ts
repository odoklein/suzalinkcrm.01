import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Call events from a customer's Allo / OnOff line. The unguessable token in the
 * path identifies the line; any event marks it as connected. Ingestion of the
 * call itself happens in the customer's dedicated instance after provisioning.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ provider: string; token: string }> }) {
    const { provider, token } = await params;
    const expected = provider.toUpperCase();
    if (expected !== "ALLO" && expected !== "ONOFF") {
        return NextResponse.json({ ok: false }, { status: 404 });
    }
    const line = await prisma.saasPhoneLine.findUnique({ where: { webhookToken: token } });
    if (!line || line.provider !== expected) {
        return NextResponse.json({ ok: false }, { status: 404 });
    }
    const now = new Date();
    await prisma.saasPhoneLine.update({
        where: { id: line.id },
        data: { lastEventAt: now, verifiedAt: line.verifiedAt ?? now },
    });
    return NextResponse.json({ ok: true });
}
