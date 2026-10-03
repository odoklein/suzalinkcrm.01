
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const missionId = 'cmkfdbz6i00w6us0gonadzpr2';

    console.log(`Activating Mission ID: ${missionId}`);

    await prisma.mission.update({
        where: { id: missionId },
        data: { isActive: true }
    });

    console.log('Mission activated.');

    // also activate campaigns just in case
    await prisma.campaign.updateMany({
        where: { missionId: missionId },
        data: { isActive: true }
    });
    console.log('Campaigns activated.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
