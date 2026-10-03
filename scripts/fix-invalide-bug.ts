import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixInvalideBug() {
    console.log('\n🔧 Fixing INVALIDE/MEETING_CANCELLED label bug...\n');

    // Find all records where code is MEETING_CANCELLED but label is INVALIDE
    const buggedRecords = await prisma.actionStatusDefinition.findMany({
        where: {
            code: 'MEETING_CANCELLED',
            label: 'INVALIDE',
        },
    });

    console.log(`Found ${buggedRecords.length} bugged records.\n`);

    if (buggedRecords.length === 0) {
        console.log('✅ No records to fix!');
        await prisma.$disconnect();
        return;
    }

    // For each bugged record, we need to:
    // 1. Check if an INVALIDE record already exists for that scope
    // 2. If yes, delete the bugged MEETING_CANCELLED record
    // 3. If no, update the code from MEETING_CANCELLED to INVALIDE

    let fixed = 0;
    let deleted = 0;

    for (const record of buggedRecords) {
        console.log(`Processing: ${record.scopeType} / ${record.scopeId || '(global)'}`);

        // Check if INVALIDE already exists for this scope
        const invalideExists = await prisma.actionStatusDefinition.findFirst({
            where: {
                scopeType: record.scopeType,
                scopeId: record.scopeId,
                code: 'INVALIDE',
            },
        });

        if (invalideExists) {
            // INVALIDE already exists, so just delete the bugged MEETING_CANCELLED record
            await prisma.actionStatusDefinition.delete({
                where: { id: record.id },
            });
            console.log(`  ✅ Deleted duplicate (INVALIDE already exists)`);
            deleted++;
        } else {
            // No INVALIDE exists, so update this record's code to INVALIDE
            await prisma.actionStatusDefinition.update({
                where: { id: record.id },
                data: {
                    code: 'INVALIDE',
                    label: 'Invalide', // Also fix the label to proper case
                },
            });
            console.log(`  ✅ Updated code to INVALIDE`);
            fixed++;
        }
    }

    console.log(`\n✅ Fix complete!`);
    console.log(`   - Updated: ${fixed} records`);
    console.log(`   - Deleted: ${deleted} duplicate records`);
    console.log('\n🎉 The bug is now fixed. SDRs can now use "Invalide" correctly!\n');

    await prisma.$disconnect();
}

fixInvalideBug().catch(console.error);
