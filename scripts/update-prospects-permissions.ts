// Quick script to ensure prospects permissions are set up
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateProspectsPermissions() {
  console.log("Updating prospects permissions...");

  // Ensure permission exists
  const permission = await prisma.permission.upsert({
    where: { code: "pages.prospects" },
    update: {},
    create: {
      code: "pages.prospects",
      name: "Prospects",
      description: "Accès à la gestion des prospects",
      category: "pages",
    },
  });

  console.log("✅ Permission created/updated:", permission.code);

  // Ensure MANAGER role has this permission
  const rolePermission = await prisma.rolePermission.upsert({
    where: {
      role_permissionId: {
        role: "MANAGER",
        permissionId: permission.id,
      },
    },
    update: { granted: true },
    create: {
      role: "MANAGER",
      permissionId: permission.id,
      granted: true,
    },
  });

  console.log("✅ Role permission created/updated for MANAGER");

  // Also ensure other POE permissions exist
  const poePermissions = [
    { code: "features.manage_prospect_rules", name: "Gérer règles prospects", description: "Peut créer et modifier les règles de prospects", category: "features" },
    { code: "features.review_prospects", name: "Réviser prospects", description: "Peut approuver ou rejeter les prospects", category: "features" },
    { code: "features.configure_prospect_sources", name: "Configurer sources prospects", description: "Peut configurer les sources de prospects", category: "features" },
    { code: "features.activate_prospects", name: "Activer prospects", description: "Peut activer manuellement les prospects", category: "features" },
  ];

  for (const perm of poePermissions) {
    const p = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });

    await prisma.rolePermission.upsert({
      where: {
        role_permissionId: {
          role: "MANAGER",
          permissionId: p.id,
        },
      },
      update: { granted: true },
      create: {
        role: "MANAGER",
        permissionId: p.id,
        granted: true,
      },
    });
  }

  console.log("✅ All POE permissions set up for MANAGER role");
  console.log("\n🎉 Done! Please refresh your browser to see the Prospects menu item.");
}

updateProspectsPermissions()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
