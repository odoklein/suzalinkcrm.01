import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    successResponse,
    errorResponse,
    requireRole,
    withErrorHandler,
} from '@/lib/api-utils';

// Import the same permission definitions from users/route.ts
const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
    SDR: [
        "pages.dashboard",
        "pages.action",
        "pages.lists",
        "pages.opportunities",
        "pages.settings",
        "pages.email",
        "pages.comms",
        "features.export_data",
        "actions.make_calls",
        "actions.send_emails",
        "actions.send_linkedin",
        "actions.book_meetings",
        "actions.create_opportunity",
        "actions.edit_contacts",
    ],
    BUSINESS_DEVELOPER: [
        "pages.dashboard",
        "pages.action",
        "pages.lists",
        "pages.opportunities",
        "pages.settings",
        "pages.email",
        "pages.comms",
        "pages.portfolio",
        "pages.onboarding",
        "pages.clients",
        "pages.missions",
        "pages.campaigns",
        "pages.projects",
        "features.create_mission",
        "features.edit_mission",
        "features.create_list",
        "features.edit_list",
        "features.import_lists",
        "features.export_data",
        "features.create_campaign",
        "features.edit_campaign",
        "features.create_client",
        "features.edit_client",
        "actions.make_calls",
        "actions.send_emails",
        "actions.send_linkedin",
        "actions.book_meetings",
        "actions.create_opportunity",
        "actions.edit_contacts",
    ],
    MANAGER: [
        "pages.dashboard",
        "pages.clients",
        "pages.missions",
        "pages.campaigns",
        "pages.lists",
        "pages.analytics",
        "pages.planning",
        "pages.files",
        "pages.users",
        "pages.sdrs",
        "pages.projects",
        "pages.settings",
        "pages.email",
        "pages.comms",
        "pages.billing",
        "pages.prospects",
        "features.create_mission",
        "features.edit_mission",
        "features.delete_mission",
        "features.assign_sdr",
        "features.create_list",
        "features.edit_list",
        "features.delete_list",
        "features.import_lists",
        "features.export_data",
        "features.create_campaign",
        "features.edit_campaign",
        "features.delete_campaign",
        "features.create_client",
        "features.edit_client",
        "features.delete_client",
        "features.create_user",
        "features.edit_user",
        "features.delete_user",
        "features.manage_permissions",
        "features.ban_user",
        "features.upload_files",
        "features.delete_files",
        "features.manage_folders",
        "features.create_invoice",
        "features.validate_invoice",
        "features.sync_payments",
        "features.confirm_payment",
        "features.manage_prospect_rules",
        "features.review_prospects",
        "features.configure_prospect_sources",
        "features.activate_prospects",
        "actions.make_calls",
        "actions.send_emails",
        "actions.send_linkedin",
        "actions.book_meetings",
        "actions.create_opportunity",
        "actions.edit_contacts",
    ],
    CLIENT: [
        "pages.dashboard",
        "pages.analytics",
        "pages.files",
    ],
    DEVELOPER: [
        "pages.dashboard",
        "pages.projects",
        "pages.settings",
        "pages.files",
        "features.upload_files",
        "features.manage_folders",
    ],
};

const PERMISSION_DEFINITIONS: Record<string, { name: string; category: string }> = {
    "pages.dashboard": { name: "Dashboard", category: "pages" },
    "pages.action": { name: "Actions", category: "pages" },
    "pages.lists": { name: "Listes", category: "pages" },
    "pages.opportunities": { name: "Opportunités", category: "pages" },
    "pages.settings": { name: "Paramètres", category: "pages" },
    "pages.email": { name: "Email Hub", category: "pages" },
    "pages.comms": { name: "Messages", category: "pages" },
    "pages.clients": { name: "Clients", category: "pages" },
    "pages.missions": { name: "Missions", category: "pages" },
    "pages.campaigns": { name: "Campagnes", category: "pages" },
    "pages.analytics": { name: "Analytics", category: "pages" },
    "pages.planning": { name: "Planning", category: "pages" },
    "pages.files": { name: "Fichiers", category: "pages" },
    "pages.users": { name: "Utilisateurs", category: "pages" },
    "pages.sdrs": { name: "SDRs", category: "pages" },
    "pages.projects": { name: "Projets", category: "pages" },
    "pages.portfolio": { name: "Portfolio", category: "pages" },
    "pages.onboarding": { name: "Onboarding", category: "pages" },
    "pages.billing": { name: "Facturation", category: "pages" },
    "pages.prospects": { name: "Prospects", category: "pages" },
    "features.export_data": { name: "Exporter données", category: "features" },
    "features.create_mission": { name: "Créer mission", category: "features" },
    "features.edit_mission": { name: "Modifier mission", category: "features" },
    "features.delete_mission": { name: "Supprimer mission", category: "features" },
    "features.assign_sdr": { name: "Assigner SDR", category: "features" },
    "features.create_list": { name: "Créer liste", category: "features" },
    "features.edit_list": { name: "Modifier liste", category: "features" },
    "features.delete_list": { name: "Supprimer liste", category: "features" },
    "features.import_lists": { name: "Importer listes", category: "features" },
    "features.create_campaign": { name: "Créer campagne", category: "features" },
    "features.edit_campaign": { name: "Modifier campagne", category: "features" },
    "features.delete_campaign": { name: "Supprimer campagne", category: "features" },
    "features.create_client": { name: "Créer client", category: "features" },
    "features.edit_client": { name: "Modifier client", category: "features" },
    "features.delete_client": { name: "Supprimer client", category: "features" },
    "features.create_user": { name: "Créer utilisateur", category: "features" },
    "features.edit_user": { name: "Modifier utilisateur", category: "features" },
    "features.delete_user": { name: "Supprimer utilisateur", category: "features" },
    "features.manage_permissions": { name: "Gérer permissions", category: "features" },
    "features.ban_user": { name: "Bannir utilisateur", category: "features" },
    "features.upload_files": { name: "Uploader fichiers", category: "features" },
    "features.delete_files": { name: "Supprimer fichiers", category: "features" },
    "features.manage_folders": { name: "Gérer dossiers", category: "features" },
    "features.create_invoice": { name: "Créer facture", category: "features" },
    "features.validate_invoice": { name: "Valider facture", category: "features" },
    "features.sync_payments": { name: "Synchroniser paiements", category: "features" },
    "features.confirm_payment": { name: "Confirmer paiement", category: "features" },
    "features.manage_prospect_rules": { name: "Gérer règles prospects", category: "features" },
    "features.review_prospects": { name: "Réviser prospects", category: "features" },
    "features.configure_prospect_sources": { name: "Configurer sources prospects", category: "features" },
    "features.activate_prospects": { name: "Activer prospects", category: "features" },
    "actions.make_calls": { name: "Passer appels", category: "actions" },
    "actions.send_emails": { name: "Envoyer emails", category: "actions" },
    "actions.send_linkedin": { name: "Envoyer LinkedIn", category: "actions" },
    "actions.book_meetings": { name: "Réserver RDV", category: "actions" },
    "actions.create_opportunity": { name: "Créer opportunité", category: "actions" },
    "actions.edit_contacts": { name: "Modifier contacts", category: "actions" },
};

// ============================================
// POST /api/users/[id]/reset-permissions - Reset user permissions to role defaults
// ============================================

export const POST = withErrorHandler(async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) => {
    await requireRole(['MANAGER'], request);
    const { id } = await params;

    // Get user
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
    });

    if (!user) {
        return errorResponse('Utilisateur non trouvé', 404);
    }

    // Get default permissions for the role
    const defaultPermissionCodes = ROLE_DEFAULT_PERMISSIONS[user.role] || [];

    if (defaultPermissionCodes.length === 0) {
        return errorResponse('Aucune permission par défaut définie pour ce rôle', 400);
    }

    // Reset permissions in a transaction
    await prisma.$transaction(async (tx) => {
        // Delete all existing user permissions
        await tx.userPermission.deleteMany({
            where: { userId: id },
        });

        // Ensure all required permissions exist, create them if they don't
        const permissionMap = new Map<string, string>();
        
        for (const code of defaultPermissionCodes) {
            let permission = await tx.permission.findUnique({
                where: { code },
            });

            if (!permission) {
                // Create the permission if it doesn't exist
                const def = PERMISSION_DEFINITIONS[code];
                if (def) {
                    permission = await tx.permission.create({
                        data: {
                            code,
                            name: def.name,
                            category: def.category,
                        },
                    });
                }
            }

            if (permission) {
                permissionMap.set(code, permission.id);
            }
        }

        // Create UserPermission entries for all default role permissions
        const userPermissionsToCreate = Array.from(permissionMap.entries())
            .map(([code, permissionId]) => ({
                userId: id,
                permissionId,
                granted: true,
            }));

        if (userPermissionsToCreate.length > 0) {
            await tx.userPermission.createMany({
                data: userPermissionsToCreate,
                skipDuplicates: true,
            });
        }
    });

    return successResponse({
        message: 'Permissions réinitialisées aux valeurs par défaut',
    });
});
