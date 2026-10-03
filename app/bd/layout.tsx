"use client";

import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { BD_NAV } from "@/lib/navigation/config";

export default function BDLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppLayoutShell
            allowedRoles={["BUSINESS_DEVELOPER"]}
            customNavigation={BD_NAV}
        >
            {children}
        </AppLayoutShell>
    );
}
