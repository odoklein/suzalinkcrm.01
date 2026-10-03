import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedEndpoints() {
  console.log('🌱 Seeding external endpoints...');

  const endpoints = [
    {
      path: '/api/stats',
      name: 'Dashboard Statistics',
      description: 'Get comprehensive dashboard statistics including actions, meetings, conversion rates, and performance metrics',
      methods: ['GET'],
      minRole: 'MANAGER',
      supportsClientScope: true,
      supportsMissionScope: true,
      isEnabled: true,
      defaultRateLimitPerMinute: 60,
      defaultRateLimitPerHour: 1000,
    },
    {
      path: '/api/stats/missions-summary',
      name: 'Missions Summary',
      description: 'Get a summary of all active missions with activity metrics and performance data',
      methods: ['GET'],
      minRole: 'MANAGER',
      supportsClientScope: true,
      supportsMissionScope: false,
      isEnabled: true,
      defaultRateLimitPerMinute: 60,
      defaultRateLimitPerHour: 1000,
    },
    {
      path: '/api/prospects/intake',
      name: 'Prospect Intake',
      description: 'Submit new prospects for processing and enrichment',
      methods: ['POST'],
      minRole: 'CLIENT',
      supportsClientScope: true,
      supportsMissionScope: true,
      isEnabled: true,
      defaultRateLimitPerMinute: 30,
      defaultRateLimitPerHour: 500,
    },
    {
      path: '/api/prospects',
      name: 'Prospects List',
      description: 'Get a list of prospects with filtering and pagination',
      methods: ['GET'],
      minRole: 'SDR',
      supportsClientScope: true,
      supportsMissionScope: true,
      isEnabled: true,
      defaultRateLimitPerMinute: 60,
      defaultRateLimitPerHour: 1000,
    },
    {
      path: '/api/meetings',
      name: 'Meetings',
      description: 'Get scheduled meetings and calendar data',
      methods: ['GET'],
      minRole: 'SDR',
      supportsClientScope: true,
      supportsMissionScope: true,
      isEnabled: true,
      defaultRateLimitPerMinute: 60,
      defaultRateLimitPerHour: 1000,
    },
    {
      path: '/api/activities',
      name: 'Activities',
      description: 'Get activity logs and interaction history',
      methods: ['GET'],
      minRole: 'SDR',
      supportsClientScope: true,
      supportsMissionScope: true,
      isEnabled: true,
      defaultRateLimitPerMinute: 60,
      defaultRateLimitPerHour: 1000,
    },
  ];

  for (const endpoint of endpoints) {
    const existing = await prisma.externalEndpoint.findUnique({
      where: { path: endpoint.path },
    });

    if (existing) {
      console.log(`  ✓ Endpoint ${endpoint.path} already exists, updating...`);
      await prisma.externalEndpoint.update({
        where: { path: endpoint.path },
        data: endpoint,
      });
    } else {
      console.log(`  + Creating endpoint ${endpoint.path}...`);
      await prisma.externalEndpoint.create({
        data: endpoint,
      });
    }
  }

  console.log('✅ Endpoints seeded successfully!');
}

async function main() {
  try {
    await seedEndpoints();
  } catch (error) {
    console.error('❌ Error seeding endpoints:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
