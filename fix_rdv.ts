import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const actions = await prisma.action.findMany({
        where: {
            result: { in: ['MEETING_BOOKED', 'MEETING_CANCELLED', 'CALLBACK_REQUESTED'] },
            callbackDate: null,
        },
        select: {
            id: true,
            createdAt: true,
            result: true,
        }
    });

    console.log(`Found ${actions.length} actions without callbackDate.`);

    if (actions.length > 0) {
        let count = 0;
        for (const action of actions) {
            await prisma.action.update({
                where: { id: action.id },
                data: { callbackDate: action.createdAt }
            });
            count++;
        }
        console.log(`Updated ${count} actions.`);
    }

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
