import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvalideBug() {
    console.log('\n🔍 Checking for INVALIDE/MEETING_CANCELLED label bug...\n');

    // Check all ActionStatusDefinition records
    const allStatuses = await prisma.actionStatusDefinition.findMany({
        where: {
            OR: [
                { code: 'INVALIDE' },
                { code: 'MEETING_CANCELLED' },
            ],
        },
        orderBy: [
            { scopeType: 'asc' },
            { code: 'asc' },
        ],
    });

    console.log('📊 All INVALIDE and MEETING_CANCELLED status definitions:\n');
    for (const status of allStatuses) {
        const flag = status.code === 'MEETING_CANCELLED' && status.label === 'Invalide' ? '❌ BUG!' : '✅';
        console.log(`${flag} ${status.scopeType} | ${status.scopeId || '(global)'} | code: ${status.code} | label: "${status.label}"`);
    }

    // Check for the specific bug
    const buggedRecords = allStatuses.filter(
        s => s.code === 'MEETING_CANCELLED' && (s.label === 'Invalide' || s.label === 'INVALIDE')
    );

    if (buggedRecords.length > 0) {
        console.log('\n🐛 FOUND BUG! The following records have MEETING_CANCELLED code with "Invalide" label:');
        for (const record of buggedRecords) {
            console.log(`   - ID: ${record.id}`);
            console.log(`     Scope: ${record.scopeType} / ${record.scopeId || '(global)'}`);
            console.log(`     Code: ${record.code}`);
            console.log(`     Label: ${record.label}`);
            console.log('');
        }
    } else {
        console.log('\n✅ No bug found in ActionStatusDefinition table.');
        console.log('   The bug might be in a mission/campaign-specific override or in the frontend.');
    }

    // Check if INVALIDE status exists at all
    const invalideStatuses = allStatuses.filter(s => s.code === 'INVALIDE');
    if (invalideStatuses.length === 0) {
        console.log('\n⚠️  WARNING: No INVALIDE status definition found!');
        console.log('   This might mean the seed hasn\'t been run or INVALIDE was never created.');
    }

    await prisma.$disconnect();
}

checkInvalideBug().catch(console.error);
