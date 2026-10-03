
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const missionId = 'cmkfdbz6i00w6us0gonadzpr2';
    const sdrId = 'cmke101jn0001uszobnt3hjn9';

    console.log(`Checking for Mission ID: ${missionId}, SDR ID: ${sdrId}`);

    // 1. Check Mission and active status
    const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        include: { sdrAssignments: true }
    });
    console.log('1. Mission:', mission ? { id: mission.id, name: mission.name, isActive: mission.isActive } : 'Not Found');
    console.log('   Assignments:', mission?.sdrAssignments);

    // 2. Check Active Campaigns for this mission
    const campaigns = await prisma.campaign.findMany({
        where: { missionId: missionId }
    });
    console.log('2. Campaigns:', campaigns.map(c => ({ id: c.id, name: c.name, isActive: c.isActive })));

    // 3. Check Lists and Contacts
    const lists = await prisma.list.findMany({
        where: { missionId: missionId },
        include: {
            _count: {
                select: { companies: true }
            }
        }
    });
    console.log('3. Lists:', lists.map(l => ({ id: l.id, name: l.name, companyCount: l._count.companies })));

    // 4. Check a sample of contacts to see their status and linkage
    const sampleContacts = await prisma.contact.findMany({
        where: {
            company: {
                list: {
                    missionId: missionId
                }
            }
        },
        take: 5,
        select: {
            id: true,
            status: true,
            company: {
                select: {
                    id: true,
                    list: {
                        select: {
                            id: true,
                            missionId: true
                        }
                    }
                }
            }
        }
    });
    console.log('4. Sample Contacts from this mission:', JSON.stringify(sampleContacts, null, 2));

    // 5. Check if the big query condition is met
    // Condition: sa."sdrId" = $1 AND m."isActive" = true AND camp."isActive" = true AND c.status != 'INCOMPLETE'

    if (!mission?.isActive) console.warn('WARNING: Mission is inactive!');
    const activeCampaigns = campaigns.filter(c => c.isActive);
    if (activeCampaigns.length === 0) console.warn('WARNING: No active campaigns for this mission!');

    const validContacts = sampleContacts.filter(c => c.status !== 'INCOMPLETE');
    console.log(`5. Contacts eligible (status != INCOMPLETE): ${validContacts.length} / ${sampleContacts.length}`);

}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
