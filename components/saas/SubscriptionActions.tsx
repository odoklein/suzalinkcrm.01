"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useConfirm, useToast } from "@/components/ui";
import { saasFetch } from "@/lib/saas/client-api";

export function SubscriptionActions({ canceled, periodEnd }: { canceled: boolean; periodEnd: string | null }) {
    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();
    const [busy, setBusy] = useState(false);
    const endLabel = periodEnd ? new Date(periodEnd).toLocaleDateString("fr-FR") : "la fin de la période";

    const run = async (action: "cancel" | "resume") => {
        if (action === "cancel") {
            const ok = await confirm({
                title: "Résilier l'abonnement ?",
                message: `Votre espace reste accessible jusqu'au ${endLabel}. Vous pouvez annuler la résiliation d'ici là.`,
                confirmText: "Résilier",
                variant: "danger",
            });
            if (!ok) return;
        }
        setBusy(true);
        const res = await saasFetch("/api/saas/billing", { body: { action } });
        setBusy(false);
        if (!res.ok) return toast.error("Action impossible", res.error);
        toast.success(action === "cancel" ? "Abonnement résilié" : "Résiliation annulée");
        router.refresh();
    };

    return canceled ? (
        <Button variant="secondary" isLoading={busy} onClick={() => run("resume")}>
            Annuler la résiliation
        </Button>
    ) : (
        <Button variant="ghost" isLoading={busy} onClick={() => run("cancel")}>
            Résilier
        </Button>
    );
}
