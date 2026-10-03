import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
    { code: "RDV_PRIS", label: "RDV pris", color: "#4CAF50", sortOrder: 1, description: "Rendez-vous planifié avec le prospect" },
    { code: "RAPPEL", label: "Rappel demandé", color: "#2196F3", sortOrder: 2, description: "Le prospect a demandé à être rappelé" },
    { code: "INTERESSE", label: "Intéressé", color: "#8BC34A", sortOrder: 3, description: "Le prospect montre de l'intérêt" },
    { code: "PROJET_A_SUIVRE", label: "Projet à suivre", color: "#009688", sortOrder: 4, description: "Projet identifié, à suivre dans le temps" },
    { code: "PAS_DE_REPONSE", label: "Pas de réponse", color: "#9E9E9E", sortOrder: 5, description: "Aucune réponse du prospect (NRP, messagerie, absent)" },
    { code: "BARRAGE", label: "Barrage", color: "#FF9800", sortOrder: 6, description: "Barrage standard ou secrétaire" },
    { code: "REFUS", label: "Refus", color: "#F44336", sortOrder: 7, description: "Le prospect n'est pas intéressé ou refuse catégoriquement" },
    { code: "DISQUALIFIE", label: "Disqualifié", color: "#795548", sortOrder: 8, description: "Contact invalide, hors cible, mauvais numéro" },
    { code: "EMAIL", label: "Email / Courrier", color: "#9C27B0", sortOrder: 9, description: "Envoi de mail ou documentation demandée" },
    { code: "LINKEDIN", label: "LinkedIn", color: "#0A66C2", sortOrder: 10, description: "Interactions via LinkedIn (connexion, message)" },
    { code: "ANNULATION", label: "Annulation", color: "#FF5722", sortOrder: 11, description: "RDV ou meeting annulé" },
];

async function main() {
    console.log('Seeding result categories...');

    for (const cat of CATEGORIES) {
        const existing = await prisma.resultCategory.findUnique({ where: { code: cat.code } });
        if (existing) {
            console.log(`  ~ Updating ${cat.code}`);
            await prisma.resultCategory.update({ where: { code: cat.code }, data: cat });
        } else {
            console.log(`  + Creating ${cat.code}`);
            await prisma.resultCategory.create({ data: cat });
        }
    }

    console.log('Done! Result categories seeded.');
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
