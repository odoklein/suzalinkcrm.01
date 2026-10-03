import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicShell } from "@/components/saas/PublicShell";
import { LoginPanel } from "./LoginPanel";

export const metadata: Metadata = { title: "Connexion" };

export default function SaasLoginPage() {
    return (
        <PublicShell compact>
            <Suspense>
                <LoginPanel />
            </Suspense>
        </PublicShell>
    );
}
