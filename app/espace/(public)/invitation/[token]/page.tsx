import type { Metadata } from "next";
import { PublicShell } from "@/components/saas/PublicShell";
import { AcceptInvite } from "./AcceptInvite";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return (
        <PublicShell compact>
            <AcceptInvite token={token} />
        </PublicShell>
    );
}
