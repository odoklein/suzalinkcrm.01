import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";

/** Header + footer for the public self-serve pages (/tarifs, /inscription, /espace/connexion). */
export function PublicShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
    return (
        <div className="min-h-screen bg-canvas text-ink flex flex-col">
            <header className="border-b border-line-subtle bg-surface/80 backdrop-blur sticky top-0 z-20">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link href="/tarifs" aria-label="Accueil des offres">
                        <BrandLogo height={24} />
                    </Link>
                    <nav className="flex items-center gap-1 text-[13px]">
                        {!compact && (
                            <Link href="/tarifs" className="rounded-lg px-3 py-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
                                Offres
                            </Link>
                        )}
                        <Link
                            href="/espace/connexion"
                            className="rounded-lg px-3 py-1.5 font-medium text-ink-2 hover:bg-surface-3 hover:text-ink"
                        >
                            Se connecter
                        </Link>
                    </nav>
                </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-line-subtle py-6 text-center text-xs text-ink-4">
                Prix HT. TVA 20 % appliquée au paiement. Instance dédiée hébergée en Europe.
            </footer>
        </div>
    );
}
