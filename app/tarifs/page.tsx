import type { Metadata } from "next";
import { PublicShell } from "@/components/saas/PublicShell";
import { PricingTable } from "@/components/saas/PricingTable";
import { TRIAL_DAYS } from "@/lib/saas/plans";

export const metadata: Metadata = {
    title: "Offres & tarifs",
    description: "CRM d'exécution outbound tout-en-un : téléphonie Allo/OnOff, Call Vault et Fiches de RDV Mistral AI.",
};

const FAQ = [
    {
        q: `Comment fonctionne l'essai de ${TRIAL_DAYS} jours ?`,
        a: `Les offres Indépendant et Small Business s'essaient gratuitement pendant ${TRIAL_DAYS} jours, sans carte bancaire. Pendant l'essai, l'import est limité à 2 000 contacts et 25 Fiches de RDV IA. Vous activez l'abonnement quand vous voulez ; vos réglages et vos données sont conservés.`,
    },
    {
        q: "Pourquoi l'offre Medium Business n'a-t-elle pas d'essai ?",
        a: "Elle inclut la marque blanche, un domaine dédié et un Account Manager : nous provisionnons une instance sur mesure dès la souscription. Une démo personnalisée est possible avant de vous engager.",
    },
    {
        q: "Puis-je garder mes numéros Allo ou OnOff ?",
        a: "Oui. Vous connectez vos lignes existantes par webhook pendant l'onboarding ; vos commerciaux gardent leur application habituelle.",
    },
    {
        q: "Puis-je changer d'offre ?",
        a: "À tout moment depuis votre espace. Le passage à une offre inférieure est possible si votre usage (sièges, workspaces, lignes) tient dans ses limites.",
    },
];

export default function PricingPage() {
    return (
        <PublicShell>
            <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="text-[13px] font-semibold text-primary">Un seul outil au lieu de cinq</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                        CRM, téléphonie, Call Vault et IA pour le prix d&apos;un seul logiciel
                    </h1>
                    <p className="mt-4 text-[15px] leading-relaxed text-ink-3">
                        Vos commerciaux appellent avec Allo ou OnOff, chaque appel est enregistré, et dès qu&apos;un prospect dit
                        oui, Mistral AI rédige la Fiche de RDV pour le closer.
                    </p>
                </div>

                <div className="mt-10">
                    <PricingTable />
                </div>

                <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq-title">
                    <h2 id="faq-title" className="text-xl font-semibold text-ink">
                        Questions fréquentes
                    </h2>
                    <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
                        {FAQ.map((item) => (
                            <details key={item.q} className="group px-5 py-4">
                                <summary className="cursor-pointer list-none text-[14px] font-medium text-ink marker:hidden">
                                    {item.q}
                                </summary>
                                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </section>
            </div>
        </PublicShell>
    );
}
