import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Database Reset Script
 * 
 * This script:
 * 1. Deletes all existing data from all tables (respecting foreign key constraints)
 * 2. Seeds the permissions for all roles
 * 3. Creates a single initial MANAGER user
 * 
 * IMPORTANT: This should ONLY be run in development or via explicit command.
 * DO NOT run this on production data!
 */

async function deleteAllData() {
    console.log("\n🗑️  Deleting all data from database...\n");

    // Delete in order to respect foreign key constraints
    // Start with tables that have no dependents, work up to root tables

    // Internal Communication Module
    await prisma.commsBroadcastReceipt.deleteMany({});
    console.log("✅ Deleted CommsBroadcastReceipt");

    await prisma.commsAttachment.deleteMany({});
    console.log("✅ Deleted CommsAttachment");

    await prisma.commsMention.deleteMany({});
    console.log("✅ Deleted CommsMention");

    await prisma.commsMessage.deleteMany({});
    console.log("✅ Deleted CommsMessage");

    await prisma.commsParticipant.deleteMany({});
    console.log("✅ Deleted CommsParticipant");

    await prisma.commsThread.deleteMany({});
    console.log("✅ Deleted CommsThread");

    await prisma.commsGroupMember.deleteMany({});
    console.log("✅ Deleted CommsGroupMember");

    await prisma.commsGroup.deleteMany({});
    console.log("✅ Deleted CommsGroup");

    await prisma.commsChannel.deleteMany({});
    console.log("✅ Deleted CommsChannel");

    // Email Hub - Templates
    await prisma.emailTemplate.deleteMany({});
    console.log("✅ Deleted EmailTemplate");

    // Email Hub - Audit & Analytics
    await prisma.emailAuditLog.deleteMany({});
    console.log("✅ Deleted EmailAuditLog");

    await prisma.emailAnalyticsDaily.deleteMany({});
    console.log("✅ Deleted EmailAnalyticsDaily");

    // Email Hub - Sequences
    await prisma.emailSequenceEnrollment.deleteMany({});
    console.log("✅ Deleted EmailSequenceEnrollment");

    await prisma.emailSequenceStep.deleteMany({});
    console.log("✅ Deleted EmailSequenceStep");

    await prisma.emailSequence.deleteMany({});
    console.log("✅ Deleted EmailSequence");

    // Email Hub - Threads & Messages
    await prisma.threadComment.deleteMany({});
    console.log("✅ Deleted ThreadComment");

    await prisma.emailAttachment.deleteMany({});
    console.log("✅ Deleted EmailAttachment");

    await prisma.email.deleteMany({});
    console.log("✅ Deleted Email");

    await prisma.emailThread.deleteMany({});
    console.log("✅ Deleted EmailThread");

    // Email Hub - Mailboxes
    await prisma.mailboxPermission.deleteMany({});
    console.log("✅ Deleted MailboxPermission");

    await prisma.mailbox.deleteMany({});
    console.log("✅ Deleted Mailbox");

    // Email Accounts (legacy)
    await prisma.emailAccount.deleteMany({});
    console.log("✅ Deleted EmailAccount");

    // Notifications
    await prisma.notification.deleteMany({});
    console.log("✅ Deleted Notification");

    // Permissions
    await prisma.userPermission.deleteMany({});
    console.log("✅ Deleted UserPermission");

    await prisma.rolePermission.deleteMany({});
    console.log("✅ Deleted RolePermission");

    await prisma.permission.deleteMany({});
    console.log("✅ Deleted Permission");

    // Scheduling
    await prisma.scheduleBlock.deleteMany({});
    console.log("✅ Deleted ScheduleBlock");

    // Business Developer
    await prisma.clientOnboarding.deleteMany({});
    console.log("✅ Deleted ClientOnboarding");

    await prisma.businessDeveloperClient.deleteMany({});
    console.log("✅ Deleted BusinessDeveloperClient");

    // Projects & Tasks
    await prisma.taskComment.deleteMany({});
    console.log("✅ Deleted TaskComment");

    await prisma.task.deleteMany({});
    console.log("✅ Deleted Task");

    await prisma.projectMember.deleteMany({});
    console.log("✅ Deleted ProjectMember");

    await prisma.project.deleteMany({});
    console.log("✅ Deleted Project");

    // Google Drive
    await prisma.googleDriveSync.deleteMany({});
    console.log("✅ Deleted GoogleDriveSync");

    // Files & Folders
    await prisma.file.deleteMany({});
    console.log("✅ Deleted File");

    await prisma.folder.deleteMany({});
    console.log("✅ Deleted Folder");

    // CRM Core
    await prisma.opportunity.deleteMany({});
    console.log("✅ Deleted Opportunity");

    await prisma.action.deleteMany({});
    console.log("✅ Deleted Action");

    await prisma.contact.deleteMany({});
    console.log("✅ Deleted Contact");

    await prisma.company.deleteMany({});
    console.log("✅ Deleted Company");

    await prisma.list.deleteMany({});
    console.log("✅ Deleted List");

    await prisma.campaign.deleteMany({});
    console.log("✅ Deleted Campaign");

    await prisma.sDRAssignment.deleteMany({});
    console.log("✅ Deleted SDRAssignment");

    await prisma.mission.deleteMany({});
    console.log("✅ Deleted Mission");

    await prisma.client.deleteMany({});
    console.log("✅ Deleted Client");

    // Users (last, as many tables reference it)
    await prisma.user.deleteMany({});
    console.log("✅ Deleted User");

    console.log("\n✨ All data deleted successfully!\n");
}

// ============================================
// PERMISSION DEFINITIONS
// ============================================

interface PermissionDef {
    code: string;
    name: string;
    description: string;
    category: string;
}

const PERMISSIONS: PermissionDef[] = [
    // Pages - Manager
    { code: "pages.dashboard", name: "Dashboard", description: "Accès au tableau de bord", category: "pages" },
    { code: "pages.clients", name: "Clients", description: "Accès à la gestion des clients", category: "pages" },
    { code: "pages.missions", name: "Missions", description: "Accès à la gestion des missions", category: "pages" },
    { code: "pages.campaigns", name: "Campagnes", description: "Accès à la gestion des campagnes", category: "pages" },
    { code: "pages.lists", name: "Listes", description: "Accès à la gestion des listes", category: "pages" },
    { code: "pages.analytics", name: "Analytics", description: "Accès aux statistiques et analytics", category: "pages" },
    { code: "pages.planning", name: "Planning", description: "Accès au planning des SDRs", category: "pages" },
    { code: "pages.files", name: "Fichiers", description: "Accès à la gestion des fichiers", category: "pages" },
    { code: "pages.users", name: "Utilisateurs", description: "Accès à la gestion des utilisateurs", category: "pages" },
    { code: "pages.sdrs", name: "SDRs", description: "Accès à la liste des SDRs", category: "pages" },
    { code: "pages.projects", name: "Projets", description: "Accès à la gestion des projets", category: "pages" },

    // Pages - Email Hub
    { code: "pages.email", name: "Email Hub", description: "Accès au hub email", category: "pages" },
    { code: "pages.comms", name: "Communications", description: "Accès au module de communication", category: "pages" },

    // Pages - SDR/BD
    { code: "pages.action", name: "Actions", description: "Accès à la page d'actions SDR", category: "pages" },
    { code: "pages.opportunities", name: "Opportunités", description: "Accès aux opportunités", category: "pages" },
    { code: "pages.settings", name: "Paramètres", description: "Accès aux paramètres personnels", category: "pages" },
    { code: "pages.portfolio", name: "Portfolio", description: "Accès au portfolio BD", category: "pages" },
    { code: "pages.onboarding", name: "Onboarding", description: "Accès à l'onboarding client", category: "pages" },

    // Features - Mission Management
    { code: "features.create_mission", name: "Créer mission", description: "Peut créer de nouvelles missions", category: "features" },
    { code: "features.edit_mission", name: "Modifier mission", description: "Peut modifier les missions existantes", category: "features" },
    { code: "features.delete_mission", name: "Supprimer mission", description: "Peut supprimer des missions", category: "features" },
    { code: "features.assign_sdr", name: "Assigner SDR", description: "Peut assigner des SDRs aux missions", category: "features" },

    // Features - List Management
    { code: "features.create_list", name: "Créer liste", description: "Peut créer de nouvelles listes", category: "features" },
    { code: "features.edit_list", name: "Modifier liste", description: "Peut modifier les listes existantes", category: "features" },
    { code: "features.delete_list", name: "Supprimer liste", description: "Peut supprimer des listes", category: "features" },
    { code: "features.import_lists", name: "Importer listes", description: "Peut importer des listes CSV/Excel", category: "features" },
    { code: "features.export_data", name: "Exporter données", description: "Peut exporter les données", category: "features" },

    // Features - Campaign Management
    { code: "features.create_campaign", name: "Créer campagne", description: "Peut créer de nouvelles campagnes", category: "features" },
    { code: "features.edit_campaign", name: "Modifier campagne", description: "Peut modifier les campagnes", category: "features" },
    { code: "features.delete_campaign", name: "Supprimer campagne", description: "Peut supprimer des campagnes", category: "features" },

    // Features - Client Management
    { code: "features.create_client", name: "Créer client", description: "Peut créer de nouveaux clients", category: "features" },
    { code: "features.edit_client", name: "Modifier client", description: "Peut modifier les clients", category: "features" },
    { code: "features.delete_client", name: "Supprimer client", description: "Peut supprimer des clients", category: "features" },

    // Features - User Management
    { code: "features.create_user", name: "Créer utilisateur", description: "Peut créer de nouveaux utilisateurs", category: "features" },
    { code: "features.edit_user", name: "Modifier utilisateur", description: "Peut modifier les utilisateurs", category: "features" },
    { code: "features.delete_user", name: "Supprimer utilisateur", description: "Peut supprimer des utilisateurs", category: "features" },
    { code: "features.manage_permissions", name: "Gérer permissions", description: "Peut gérer les permissions des utilisateurs", category: "features" },
    { code: "features.ban_user", name: "Bannir utilisateur", description: "Peut bannir/débannir des utilisateurs", category: "features" },

    // Features - File Management
    { code: "features.upload_files", name: "Téléverser fichiers", description: "Peut téléverser des fichiers", category: "features" },
    { code: "features.delete_files", name: "Supprimer fichiers", description: "Peut supprimer des fichiers", category: "features" },
    { code: "features.manage_folders", name: "Gérer dossiers", description: "Peut créer/modifier/supprimer des dossiers", category: "features" },

    // Actions - SDR Operations
    { code: "actions.make_calls", name: "Passer appels", description: "Peut effectuer des appels", category: "actions" },
    { code: "actions.send_emails", name: "Envoyer emails", description: "Peut envoyer des emails", category: "actions" },
    { code: "actions.send_linkedin", name: "Envoyer LinkedIn", description: "Peut envoyer des messages LinkedIn", category: "actions" },
    { code: "actions.book_meetings", name: "Réserver RDV", description: "Peut réserver des rendez-vous", category: "actions" },
    { code: "actions.create_opportunity", name: "Créer opportunité", description: "Peut créer des opportunités", category: "actions" },
    { code: "actions.edit_contacts", name: "Modifier contacts", description: "Peut modifier les informations de contact", category: "actions" },
];

// Role-based default permissions
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
    MANAGER: [
        // Full access to all pages
        "pages.dashboard", "pages.clients", "pages.missions", "pages.campaigns",
        "pages.lists", "pages.analytics", "pages.planning", "pages.files",
        "pages.users", "pages.sdrs", "pages.projects", "pages.settings", "pages.email", "pages.comms",
        // Full access to all features
        "features.create_mission", "features.edit_mission", "features.delete_mission", "features.assign_sdr",
        "features.create_list", "features.edit_list", "features.delete_list", "features.import_lists", "features.export_data",
        "features.create_campaign", "features.edit_campaign", "features.delete_campaign",
        "features.create_client", "features.edit_client", "features.delete_client",
        "features.create_user", "features.edit_user", "features.delete_user", "features.manage_permissions", "features.ban_user",
        "features.upload_files", "features.delete_files", "features.manage_folders",
        // All actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin",
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    SDR: [
        // Limited pages
        "pages.dashboard", "pages.action", "pages.lists", "pages.opportunities", "pages.settings", "pages.email", "pages.comms",
        // Limited features
        "features.export_data",
        // SDR actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin",
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    BUSINESS_DEVELOPER: [
        // BD pages (superset of SDR)
        "pages.dashboard", "pages.action", "pages.lists", "pages.opportunities", "pages.settings", "pages.email", "pages.comms",
        "pages.portfolio", "pages.onboarding", "pages.clients", "pages.missions", "pages.campaigns", "pages.projects",
        // BD features
        "features.create_mission", "features.edit_mission",
        "features.create_list", "features.edit_list", "features.import_lists", "features.export_data",
        "features.create_campaign", "features.edit_campaign",
        "features.create_client", "features.edit_client",
        // All actions
        "actions.make_calls", "actions.send_emails", "actions.send_linkedin",
        "actions.book_meetings", "actions.create_opportunity", "actions.edit_contacts",
    ],
    CLIENT: [
        // Client pages only
        "pages.dashboard", "pages.analytics", "pages.files",
        // No features
        // No actions
    ],
    DEVELOPER: [
        // Developer pages
        "pages.dashboard", "pages.projects", "pages.settings", "pages.files",
        // Developer features
        "features.upload_files", "features.manage_folders",
        // No features
        // No actions
    ],
};

async function seedPermissions() {
    console.log("\n📋 Seeding permissions...");

    // Create all permissions
    for (const perm of PERMISSIONS) {
        await prisma.permission.upsert({
            where: { code: perm.code },
            update: {
                name: perm.name,
                description: perm.description,
                category: perm.category,
            },
            create: perm,
        });
    }
    console.log(`✅ Created ${PERMISSIONS.length} permissions`);

    // Create role permissions
    let rolePermCount = 0;
    for (const [role, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
        for (const code of permCodes) {
            const permission = await prisma.permission.findUnique({ where: { code } });
            if (permission) {
                await prisma.rolePermission.upsert({
                    where: {
                        role_permissionId: {
                            role: role as UserRole,
                            permissionId: permission.id,
                        },
                    },
                    update: { granted: true },
                    create: {
                        role: role as UserRole,
                        permissionId: permission.id,
                        granted: true,
                    },
                });
                rolePermCount++;
            }
        }
    }
    console.log(`✅ Created ${rolePermCount} role-permission mappings`);
}

async function createInitialUser() {
    console.log("👤 Creating initial MANAGER user...\n");

    // Hash the password using bcrypt (same method as the rest of the app)
    const hashedPassword = await bcrypt.hash("Moumouche/100882", 10);

    const user = await prisma.user.create({
        data: {
            email: "hichem@suzaliconseil.com",
            password: hashedPassword,
            name: "Hichem",
            role: UserRole.MANAGER,
            isActive: true,
        },
    });

    console.log("✅ Created MANAGER user:");
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   ID: ${user.id}\n`);

    return user;
}

async function main() {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         DATABASE RESET SCRIPT - DEVELOPMENT ONLY          ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("⚠️  WARNING: This will DELETE ALL DATA from the database!");
    console.log("");

    try {
        // Use a transaction to ensure atomicity
        await prisma.$transaction(async () => {
            // Note: We can't use tx for deleteMany operations directly,
            // so we'll run them outside the transaction but in sequence
        });

        // Delete all data (in correct order)
        await deleteAllData();

        // Seed permissions
        await seedPermissions();

        // Create initial user
        await createInitialUser();

        console.log("╔════════════════════════════════════════════════════════════╗");
        console.log("║                    RESET COMPLETE! 🎉                      ║");
        console.log("╚════════════════════════════════════════════════════════════╝");
        console.log("");
        console.log("📋 Login Credentials:");
        console.log("─────────────────────────────────────────────────────────────");
        console.log("Email:    hichem@suzaliconseil.com");
        console.log("Password: Moumouche/100882");
        console.log("Role:     MANAGER");
        console.log("─────────────────────────────────────────────────────────────");
        console.log("");

    } catch (error) {
        console.error("\n❌ Error during database reset:");
        console.error(error);
        throw error;
    }
}

// Execute the script
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
