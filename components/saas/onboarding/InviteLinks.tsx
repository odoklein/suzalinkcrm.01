"use client";

import { Copy } from "lucide-react";
import { Callout, IconButton, useToast } from "@/components/ui";

/** Shown right after invitations are created: links are only visible once (only their hash is stored). */
export function InviteLinks({ links }: { links: { email: string; name: string; url: string }[] }) {
    const toast = useToast();
    const copy = (text: string) => {
        void navigator.clipboard?.writeText(text).then(
            () => toast.success("Lien copié"),
            () => toast.error("Copie impossible", "Sélectionnez le lien et copiez-le manuellement.")
        );
    };
    return (
        <Callout tone="success" title="Liens d'invitation">
            <p className="mb-2 text-[12.5px]">Copiez-les maintenant : pour des raisons de sécurité, ils ne seront plus affichés.</p>
            <ul className="space-y-1.5">
                {links.map((l) => (
                    <li key={l.email} className="flex items-center gap-2">
                        <span className="w-40 shrink-0 truncate text-[12.5px] font-medium">{l.name}</span>
                        <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-[11.5px] text-ink-2">{l.url}</code>
                        <IconButton icon={Copy} label={`Copier le lien de ${l.name}`} size="xs" variant="outline" onClick={() => copy(l.url)} />
                    </li>
                ))}
            </ul>
        </Callout>
    );
}
