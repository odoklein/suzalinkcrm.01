import { prisma } from './prisma';

// ============================================
// COMPLETENESS SCORING ENGINE
// ============================================

export type CompletenessStatus = 'INCOMPLETE' | 'PARTIAL' | 'ACTIONABLE';

// ============================================
// CONTACT SCORING
// ============================================

export interface ContactData {
    firstName?: string | null;
    lastName?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
}

export function calculateContactCompleteness(contact: ContactData): CompletenessStatus {
    const hasName = !!(contact.firstName || contact.lastName);
    const hasTitle = !!contact.title;
    const channels = [contact.phone, contact.email, contact.linkedin].filter(Boolean);
    const hasChannel = channels.length > 0;
    const hasMultipleChannels = channels.length >= 2;

    // ACTIONABLE: Name + at least 2 channels
    if (hasName && hasMultipleChannels) {
        return 'ACTIONABLE';
    }

    // ACTIONABLE: Name + Title + 1 channel (decision maker)
    if (hasName && hasTitle && hasChannel) {
        return 'ACTIONABLE';
    }

    // PARTIAL: Has some useful data
    if (hasName || hasChannel) {
        return 'PARTIAL';
    }

    // INCOMPLETE: Not enough data
    return 'INCOMPLETE';
}

// ============================================
// COMPANY SCORING
// ============================================

export interface CompanyData {
    name: string;
    country?: string | null;
    industry?: string | null;
    website?: string | null;
    size?: string | null;
    contacts?: { status: CompletenessStatus }[];
}

export function calculateCompanyCompleteness(company: CompanyData): CompletenessStatus {
    const hasCountry = !!company.country;
    const hasIndustry = !!company.industry;
    const hasWebsite = !!company.website;

    // Check contacts status
    const hasActionableContact = company.contacts?.some(c => c.status === 'ACTIONABLE') ?? false;
    const hasPartialContact = company.contacts?.some(c => c.status === 'PARTIAL') ?? false;

    // ACTIONABLE: Country + Industry + at least one actionable contact
    if (hasCountry && hasIndustry && hasActionableContact) {
        return 'ACTIONABLE';
    }

    // PARTIAL: Has some basic info or partial contacts
    if (hasCountry || hasIndustry || hasWebsite || hasPartialContact) {
        return 'PARTIAL';
    }

    // INCOMPLETE: Only name
    return 'INCOMPLETE';
}

// ============================================
// BATCH UPDATE FUNCTIONS
// ============================================

export async function updateContactStatus(contactId: string): Promise<CompletenessStatus> {
    const contact = await prisma.contact.findUnique({
        where: { id: contactId },
    });

    if (!contact) {
        throw new Error(`Contact ${contactId} not found`);
    }

    const newStatus = calculateContactCompleteness(contact);

    if (contact.status !== newStatus) {
        await prisma.contact.update({
            where: { id: contactId },
            data: { status: newStatus },
        });
    }

    return newStatus;
}

export async function updateCompanyStatus(companyId: string): Promise<CompletenessStatus> {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
            contacts: {
                select: { status: true },
            },
        },
    });

    if (!company) {
        throw new Error(`Company ${companyId} not found`);
    }

    const newStatus = calculateCompanyCompleteness({
        ...company,
        contacts: company.contacts,
    });

    if (company.status !== newStatus) {
        await prisma.company.update({
            where: { id: companyId },
            data: { status: newStatus },
        });
    }

    return newStatus;
}

export async function recalculateListCompleteness(listId: string): Promise<{
    incomplete: number;
    partial: number;
    actionable: number;
}> {
    const companies = await prisma.company.findMany({
        where: { listId },
        include: { contacts: { select: { status: true } } },
    });

    const stats = { INCOMPLETE: 0, PARTIAL: 0, ACTIONABLE: 0 };

    for (const company of companies) {
        const newStatus = calculateCompanyCompleteness({
            ...company,
            contacts: company.contacts,
        });

        if (company.status !== newStatus) {
            await prisma.company.update({
                where: { id: company.id },
                data: { status: newStatus },
            });
        }

        stats[newStatus]++;
    }

    return {
        incomplete: stats.INCOMPLETE,
        partial: stats.PARTIAL,
        actionable: stats.ACTIONABLE,
    };
}
