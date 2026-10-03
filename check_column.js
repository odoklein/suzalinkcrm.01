const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Mailbox' AND column_name = 'trackingDomain';
    `;
    console.log("Column check result:", JSON.stringify(columns, null, 2));

    if (columns.length === 0) {
      console.log("COLUMN MISSING!");
    } else {
      console.log("COLUMN EXISTS!");
    }
  } catch (e) {
    console.error("Error checking column:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
