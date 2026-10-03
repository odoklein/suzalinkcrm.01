import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyReset() {
    console.log("\n🔍 Verifying database reset...\n");

    // Check user count
    const userCount = await prisma.user.count();
    console.log(`Total users: ${userCount}`);

    // Get the manager user
    const manager = await prisma.user.findUnique({
        where: { email: "hichem@suzaliconseil.com" },
    });

    if (manager) {
        console.log("\n✅ MANAGER user found:");
        console.log(`   Email: ${manager.email}`);
        console.log(`   Name: ${manager.name}`);
        console.log(`   Role: ${manager.role}`);
        console.log(`   Active: ${manager.isActive}`);
        console.log(`   Created: ${manager.createdAt}`);
    } else {
        console.log("\n❌ MANAGER user NOT found!");
    }

    // Check other table counts
    const counts = {
        clients: await prisma.client.count(),
        missions: await prisma.mission.count(),
        campaigns: await prisma.campaign.count(),
        lists: await prisma.list.count(),
        companies: await prisma.company.count(),
        contacts: await prisma.contact.count(),
        mailboxes: await prisma.mailbox.count(),
        emailThreads: await prisma.emailThread.count(),
    };

    console.log("\n📊 Table counts:");
    Object.entries(counts).forEach(([table, count]) => {
        console.log(`   ${table}: ${count}`);
    });

    console.log("\n");
}

verifyReset()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
