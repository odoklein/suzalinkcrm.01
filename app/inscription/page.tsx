import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicShell } from "@/components/saas/PublicShell";
import { SignupFlow } from "./SignupFlow";

export const metadata: Metadata = { title: "Créer votre espace" };

export default function SignupPage() {
    return (
        <PublicShell compact>
            <Suspense>
                <SignupFlow />
            </Suspense>
        </PublicShell>
    );
}
