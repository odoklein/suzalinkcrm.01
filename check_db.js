
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const missions = await prisma.mission.findMany({
        select: { id: true, name: true, isActive: true }
    });
    console.log('Missions:', JSON.stringify(missions, null, 2));

    const users = await prisma.user.findMany({
        select: { id: true, role: true, name: true }
    });
    console.log('Users:', JSON.stringify(users, null, 2));

    const assignments = await prisma.sDRAssignment.findMany();
    console.log('Assignments:', JSON.stringify(assignments, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
