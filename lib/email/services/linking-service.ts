// ============================================
// CRM AUTO-LINKING SERVICE
// Automatically links emails to CRM entities
// ============================================

import { prisma } from '@/lib/prisma';
import { EmailThread, Client, Mission, Contact, Campaign } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface LinkingResult {
    threadId: string;
    linked: {
        clientId?: string;
        missionId?: string;
        contactId?: string;
        campaignId?: string;
        opportunityId?: string;
    };
    confidence: number;
    method: 'exact_match' | 'domain_match' | 'manual' | 'sequence';
}

export interface LinkingConfig {
    autoLinkOnSync: boolean;
    autoLinkToClient: boolean;
    autoLinkToMission: boolean;
    autoLinkToContact: boolean;
    autoLinkToCampaign: boolean;
    confidenceThreshold: number;
}

// ============================================
// CRM LINKING SERVICE CLASS
// ============================================

export class CrmLinkingService {
    private defaultConfig: LinkingConfig = {
        autoLinkOnSync: true,
        autoLinkToClient: true,
        autoLinkToMission: true,
        autoLinkToContact: true,
        autoLinkToCampaign: true,
        confidenceThreshold: 0.7,
    };

    // ============================================
    // AUTO-LINK THREAD
    // ============================================

    async autoLinkThread(
        threadId: string,
        config?: Partial<LinkingConfig>
    ): Promise<LinkingResult> {
        const cfg = { ...this.defaultConfig, ...config };
        const result: LinkingResult = {
            threadId,
            linked: {},
            confidence: 0,
            method: 'exact_match',
        };

        try {
            // Get thread with emails
            const thread = await prisma.emailThread.findUnique({
                where: { id: threadId },
                include: {
                    emails: {
                        select: {
                            fromAddress: true,
                            toAddresses: true,
                            ccAddresses: true,
                        },
                    },
                    mailbox: {
                        select: { email: true, ownerId: true },
                    },
                },
            });

            if (!thread) {
                return result;
            }

            // Extract all email addresses from thread
            const emailAddresses = this.extractEmailAddresses(thread);
            const domains = this.extractDomains(emailAddresses);

            // Skip internal emails only
            const mailboxEmail = thread.mailbox.email.toLowerCase();
            const externalEmails = emailAddresses.filter(e => e !== mailboxEmail);
            const externalDomains = this.extractDomains(externalEmails);

            if (externalEmails.length === 0) {
                return result;
            }

            // Try to link to Contact (most specific)
            if (cfg.autoLinkToContact) {
                const contactLink = await this.findContactMatch(externalEmails);
                if (contactLink) {
                    result.linked.contactId = contactLink.id;
                    result.confidence = 1.0;
                    result.method = 'exact_match';

                    // Also link to contact's company if it's a client
                    if (contactLink.company && cfg.autoLinkToClient) {
                        const client = await prisma.client.findFirst({
                            where: {
                                OR: [
                                    { email: { contains: contactLink.company.domain || '', mode: 'insensitive' } },
                                    { name: { equals: contactLink.company.name, mode: 'insensitive' } },
                                ],
                            },
                        });
                        if (client) {
                            result.linked.clientId = client.id;
                        }
                    }
                }
            }

            // Try to link to Client by email domain
            if (cfg.autoLinkToClient && !result.linked.clientId) {
                const clientLink = await this.findClientMatch(externalEmails, externalDomains);
                if (clientLink) {
                    result.linked.clientId = clientLink.id;
                    if (!result.linked.contactId) {
                        result.confidence = clientLink.confidence;
                        result.method = clientLink.confidence === 1.0 ? 'exact_match' : 'domain_match';
                    }

                    // Try to link to active mission for this client
                    if (cfg.autoLinkToMission) {
                        const mission = await this.findActiveMissionForClient(clientLink.id);
                        if (mission) {
                            result.linked.missionId = mission.id;
                        }
                    }
                }
            }

            // Try to link to Campaign (if thread came from sequence)
            if (cfg.autoLinkToCampaign) {
                const campaignLink = await this.findCampaignMatch(thread, externalEmails);
                if (campaignLink) {
                    result.linked.campaignId = campaignLink.id;
                }
            }

            // Update thread with links
            if (Object.keys(result.linked).length > 0) {
                await prisma.emailThread.update({
                    where: { id: threadId },
                    data: result.linked,
                });
            }

            return result;
        } catch (error) {
            console.error('Auto-link thread error:', error);
            return result;
        }
    }

    // ============================================
    // MANUAL LINKING
    // ============================================

    async linkThreadToClient(threadId: string, clientId: string): Promise<void> {
        await prisma.emailThread.update({
            where: { id: threadId },
            data: { clientId },
        });
    }

    async linkThreadToMission(threadId: string, missionId: string): Promise<void> {
        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: { clientId: true },
        });

        await prisma.emailThread.update({
            where: { id: threadId },
            data: {
                missionId,
                clientId: mission?.clientId,
            },
        });
    }

    async linkThreadToContact(threadId: string, contactId: string): Promise<void> {
        const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            include: { company: true },
        });

        await prisma.emailThread.update({
            where: { id: threadId },
            data: {
                contactId,
                // Try to link to client via company
                ...(contact?.company && {
                    clientId: await this.findClientByCompanyId(contact.company.id),
                }),
            },
        });
    }

    async linkThreadToCampaign(threadId: string, campaignId: string): Promise<void> {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            select: { missionId: true, mission: { select: { clientId: true } } },
        });

        await prisma.emailThread.update({
            where: { id: threadId },
            data: {
                campaignId,
                missionId: campaign?.missionId,
                clientId: campaign?.mission?.clientId,
            },
        });
    }

    async unlinkThread(threadId: string, field: 'client' | 'mission' | 'contact' | 'campaign' | 'opportunity'): Promise<void> {
        const fieldMap = {
            client: 'clientId',
            mission: 'missionId',
            contact: 'contactId',
            campaign: 'campaignId',
            opportunity: 'opportunityId',
        };

        await prisma.emailThread.update({
            where: { id: threadId },
            data: { [fieldMap[field]]: null },
        });
    }

    // ============================================
    // BULK LINKING
    // ============================================

    async autoLinkUnlinkedThreads(
        mailboxId?: string,
        limit: number = 100
    ): Promise<{ processed: number; linked: number }> {
        // Find threads with no CRM links
        const threads = await prisma.emailThread.findMany({
            where: {
                ...(mailboxId && { mailboxId }),
                clientId: null,
                contactId: null,
                missionId: null,
            },
            select: { id: true },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        let linked = 0;

        for (const thread of threads) {
            const result = await this.autoLinkThread(thread.id);
            if (Object.keys(result.linked).length > 0) {
                linked++;
            }
        }

        return {
            processed: threads.length,
            linked,
        };
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private extractEmailAddresses(thread: {
        participantEmails: string[];
        emails: { fromAddress: string; toAddresses: string[]; ccAddresses: string[] }[];
    }): string[] {
        const emails = new Set<string>();

        // From participant emails
        thread.participantEmails.forEach(e => emails.add(e.toLowerCase()));

        // From email messages
        for (const email of thread.emails) {
            emails.add(email.fromAddress.toLowerCase());
            email.toAddresses.forEach(e => emails.add(e.toLowerCase()));
            email.ccAddresses.forEach(e => emails.add(e.toLowerCase()));
        }

        return Array.from(emails);
    }

    private extractDomains(emails: string[]): string[] {
        const domains = new Set<string>();
        
        for (const email of emails) {
            const domain = email.split('@')[1];
            if (domain) {
                domains.add(domain.toLowerCase());
            }
        }

        return Array.from(domains);
    }

    private async findContactMatch(
        emails: string[]
    ): Promise<(Contact & { company: { id: string; name: string; domain: string | null } | null }) | null> {
        return prisma.contact.findFirst({
            where: {
                email: { in: emails, mode: 'insensitive' },
            },
            include: {
                company: {
                    select: { id: true, name: true, domain: true },
                },
            },
        });
    }

    private async findClientMatch(
        emails: string[],
        domains: string[]
    ): Promise<{ id: string; confidence: number } | null> {
        // First try exact email match
        const exactMatch = await prisma.client.findFirst({
            where: {
                email: { in: emails, mode: 'insensitive' },
            },
            select: { id: true },
        });

        if (exactMatch) {
            return { id: exactMatch.id, confidence: 1.0 };
        }

        // Try domain match
        for (const domain of domains) {
            // Skip common email providers
            if (this.isPublicEmailDomain(domain)) continue;

            const domainMatch = await prisma.client.findFirst({
                where: {
                    OR: [
                        { email: { contains: domain, mode: 'insensitive' } },
                        { website: { contains: domain, mode: 'insensitive' } },
                    ],
                },
                select: { id: true },
            });

            if (domainMatch) {
                return { id: domainMatch.id, confidence: 0.8 };
            }
        }

        return null;
    }

    private async findActiveMissionForClient(clientId: string): Promise<{ id: string } | null> {
        return prisma.mission.findFirst({
            where: {
                clientId,
                status: { in: ['ACTIVE', 'IN_PROGRESS'] },
            },
            select: { id: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    private async findCampaignMatch(
        thread: { id: string },
        emails: string[]
    ): Promise<{ id: string } | null> {
        // Check if any email in thread was sent via a sequence
        const sequenceEmail = await prisma.email.findFirst({
            where: {
                threadId: thread.id,
                sequenceEnrollmentId: { not: null },
            },
            select: {
                sequenceEnrollment: {
                    select: {
                        sequence: {
                            select: {
                                campaignId: true,
                            },
                        },
                    },
                },
            },
        });

        if (sequenceEmail?.sequenceEnrollment?.sequence?.campaignId) {
            return { id: sequenceEmail.sequenceEnrollment.sequence.campaignId };
        }

        return null;
    }

    private async findClientByCompanyId(companyId: string): Promise<string | null> {
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true, domain: true },
        });

        if (!company) return null;

        const client = await prisma.client.findFirst({
            where: {
                OR: [
                    { name: { equals: company.name, mode: 'insensitive' } },
                    ...(company.domain ? [
                        { website: { contains: company.domain, mode: 'insensitive' } },
                        { email: { contains: company.domain, mode: 'insensitive' } },
                    ] : []),
                ],
            },
            select: { id: true },
        });

        return client?.id || null;
    }

    private isPublicEmailDomain(domain: string): boolean {
        const publicDomains = [
            'gmail.com', 'googlemail.com',
            'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
            'yahoo.com', 'yahoo.fr',
            'icloud.com', 'me.com', 'mac.com',
            'aol.com',
            'protonmail.com', 'proton.me',
            'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net',
        ];
        return publicDomains.includes(domain.toLowerCase());
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const crmLinkingService = new CrmLinkingService();
