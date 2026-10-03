import prisma from '@/lib/prisma';
import { SUPPORTED_TEMPLATE_VARIABLES } from '../constants';

// ============================================
// TEMPLATE VARIABLE SUBSTITUTION SERVICE
// Replaces {{variable}} placeholders with actual data
// ============================================

export interface VariableContext {
    contactId?: string;
    companyId?: string;
    customData?: Record<string, string>;
}

export interface SubstitutionResult {
    subject: string;
    bodyHtml: string;
    bodyText: string | null;
    variables: Record<string, string>;
}

// Extract all variable names from text
export function extractVariables(text: string): string[] {
    const regex = /\{\{(\w+(?:\.\w+)?)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (!variables.includes(match[1])) {
            variables.push(match[1]);
        }
    }

    return variables;
}

// Build variable map from contact and company data
export async function buildVariableMap(context: VariableContext): Promise<Record<string, string>> {
    const variables: Record<string, string> = {};

    // Fetch contact data
    if (context.contactId) {
        const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
            include: {
                company: true
            }
        });

        if (contact) {
            variables.firstName = contact.firstName || '';
            variables.lastName = contact.lastName || '';
            variables.fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');
            variables.title = contact.title || '';
            variables.email = contact.email || '';
            variables.phone = contact.phone || '';
            variables.linkedin = contact.linkedin || '';

            // Company data from contact
            if (contact.company) {
                variables.company = contact.company.name || '';
                variables.companyName = contact.company.name || '';
                variables.industry = contact.company.industry || '';
                variables.website = contact.company.website || '';
                variables.country = contact.company.country || '';
                variables.companySize = contact.company.size || '';
                variables.companyPhone = contact.company.phone || '';
            }

            // Custom data
            if (contact.customData && typeof contact.customData === 'object') {
                const customData = contact.customData as Record<string, unknown>;
                Object.entries(customData).forEach(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number') {
                        variables[`custom.${key}`] = String(value);
                    }
                });
            }
        }
    }

    // Fetch company data if no contact or need direct company data
    if (context.companyId && !context.contactId) {
        const company = await prisma.company.findUnique({
            where: { id: context.companyId }
        });

        if (company) {
            variables.company = company.name || '';
            variables.companyName = company.name || '';
            variables.industry = company.industry || '';
            variables.website = company.website || '';
            variables.country = company.country || '';
            variables.companySize = company.size || '';
            variables.companyPhone = company.phone || '';

            // Custom data
            if (company.customData && typeof company.customData === 'object') {
                const customData = company.customData as Record<string, unknown>;
                Object.entries(customData).forEach(([key, value]) => {
                    if (typeof value === 'string' || typeof value === 'number') {
                        variables[`custom.${key}`] = String(value);
                    }
                });
            }
        }
    }

    // Merge custom data from context
    if (context.customData) {
        Object.entries(context.customData).forEach(([key, value]) => {
            variables[key] = value;
        });
    }

    // Add current date variables
    const now = new Date();
    variables.currentDate = now.toLocaleDateString('fr-FR');
    variables.currentDay = now.toLocaleDateString('fr-FR', { weekday: 'long' });
    variables.currentMonth = now.toLocaleDateString('fr-FR', { month: 'long' });
    variables.currentYear = String(now.getFullYear());

    return variables;
}

// Replace variables in text
export function substituteVariables(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, varName) => {
        return variables[varName] ?? '';
    });
}

// Main function: substitute all variables in template
export async function processTemplate(
    subject: string,
    bodyHtml: string,
    bodyText: string | null,
    context: VariableContext
): Promise<SubstitutionResult> {
    const variables = await buildVariableMap(context);

    return {
        subject: substituteVariables(subject, variables),
        bodyHtml: substituteVariables(bodyHtml, variables),
        bodyText: bodyText ? substituteVariables(bodyText, variables) : null,
        variables
    };
}

// Get a preview with variable highlights
export function getVariablePreview(text: string, variables: Record<string, string>): string {
    return text.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, varName) => {
        const value = variables[varName];
        if (value) {
            return `<span class="bg-emerald-100 text-emerald-700 px-1 rounded">${value}</span>`;
        }
        return `<span class="bg-amber-100 text-amber-700 px-1 rounded">${match}</span>`;
    });
}

// Re-export for documentation / backward compatibility
export const SUPPORTED_VARIABLES = SUPPORTED_TEMPLATE_VARIABLES;
