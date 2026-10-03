// ============================================
// COMMS TEMPLATES SERVICE
// CRUD for message templates
// ============================================

import { prisma } from "@/lib/prisma";

// ============================================
// TYPES
// ============================================

export interface MessageTemplate {
    id: string;
    name: string;
    category: string | null;
    content: string;
    variables: string[];
    isShared: boolean;
    usageCount: number;
    createdAt: string;
}

export interface CreateTemplateRequest {
    name: string;
    category?: string;
    content: string;
    variables?: string[];
    isShared?: boolean;
}

export interface UpdateTemplateRequest {
    name?: string;
    category?: string;
    content?: string;
    variables?: string[];
    isShared?: boolean;
}

// ============================================
// TEMPLATE CRUD
// ============================================

/**
 * Get all templates visible to a user (own + shared).
 */
export async function getTemplates(userId: string): Promise<MessageTemplate[]> {
    const templates = await prisma.commsMessageTemplate.findMany({
        where: {
            OR: [
                { userId },
                { isShared: true },
            ],
        },
        orderBy: [
            { usageCount: "desc" },
            { name: "asc" },
        ],
    });

    return templates.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        content: t.content,
        variables: t.variables,
        isShared: t.isShared,
        usageCount: t.usageCount,
        createdAt: t.createdAt.toISOString(),
    }));
}

/**
 * Get templates by category.
 */
export async function getTemplatesByCategory(
    userId: string,
    category: string
): Promise<MessageTemplate[]> {
    const templates = await prisma.commsMessageTemplate.findMany({
        where: {
            category,
            OR: [
                { userId },
                { isShared: true },
            ],
        },
        orderBy: { usageCount: "desc" },
    });

    return templates.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        content: t.content,
        variables: t.variables,
        isShared: t.isShared,
        usageCount: t.usageCount,
        createdAt: t.createdAt.toISOString(),
    }));
}

/**
 * Create a new template.
 */
export async function createTemplate(
    userId: string,
    data: CreateTemplateRequest
): Promise<MessageTemplate> {
    const template = await prisma.commsMessageTemplate.create({
        data: {
            userId,
            name: data.name,
            category: data.category || null,
            content: data.content,
            variables: data.variables || [],
            isShared: data.isShared || false,
        },
    });

    return {
        id: template.id,
        name: template.name,
        category: template.category,
        content: template.content,
        variables: template.variables,
        isShared: template.isShared,
        usageCount: template.usageCount,
        createdAt: template.createdAt.toISOString(),
    };
}

/**
 * Update a template (only owner can update).
 */
export async function updateTemplate(
    userId: string,
    templateId: string,
    data: UpdateTemplateRequest
): Promise<MessageTemplate | null> {
    // Check ownership
    const existing = await prisma.commsMessageTemplate.findFirst({
        where: { id: templateId, userId },
    });

    if (!existing) {
        return null;
    }

    const updated = await prisma.commsMessageTemplate.update({
        where: { id: templateId },
        data: {
            name: data.name,
            category: data.category,
            content: data.content,
            variables: data.variables,
            isShared: data.isShared,
        },
    });

    return {
        id: updated.id,
        name: updated.name,
        category: updated.category,
        content: updated.content,
        variables: updated.variables,
        isShared: updated.isShared,
        usageCount: updated.usageCount,
        createdAt: updated.createdAt.toISOString(),
    };
}

/**
 * Delete a template (only owner can delete).
 */
export async function deleteTemplate(
    userId: string,
    templateId: string
): Promise<boolean> {
    const result = await prisma.commsMessageTemplate.deleteMany({
        where: { id: templateId, userId },
    });

    return result.count > 0;
}

/**
 * Increment usage count when a template is used.
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
    await prisma.commsMessageTemplate.update({
        where: { id: templateId },
        data: { usageCount: { increment: 1 } },
    });
}

// ============================================
// VARIABLE SUBSTITUTION
// ============================================

export interface TemplateContext {
    client_name?: string;
    mission_name?: string;
    user_name?: string;
    company_name?: string;
    date?: string;
    [key: string]: string | undefined;
}

/**
 * Apply variable substitutions to template content.
 */
export function applyTemplateVariables(
    content: string,
    context: TemplateContext
): string {
    let result = content;

    for (const [key, value] of Object.entries(context)) {
        if (value) {
            const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
            result = result.replace(pattern, value);
        }
    }

    return result;
}

/**
 * Extract variable names from template content.
 */
export function extractTemplateVariables(content: string): string[] {
    const matches = content.match(/\{\{\s*([a-z_]+)\s*\}\}/gi);
    if (!matches) return [];

    const variables = new Set<string>();
    for (const match of matches) {
        const varName = match.replace(/\{\{\s*|\s*\}\}/g, "");
        variables.add(`{{${varName}}}`);
    }

    return Array.from(variables);
}
