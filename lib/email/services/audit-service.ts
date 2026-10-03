// ============================================
// EMAIL AUDIT LOGGING SERVICE
// Tracks all email-related actions for compliance
// ============================================

import { prisma } from '@/lib/prisma';

// ============================================
// TYPES
// ============================================

export type AuditAction = 
    | 'mailbox_connected'
    | 'mailbox_disconnected'
    | 'mailbox_synced'
    | 'email_sent'
    | 'email_opened'
    | 'email_clicked'
    | 'email_bounced'
    | 'email_replied'
    | 'thread_archived'
    | 'thread_deleted'
    | 'thread_linked'
    | 'thread_unlinked'
    | 'thread_assigned'
    | 'sequence_created'
    | 'sequence_activated'
    | 'sequence_paused'
    | 'sequence_deleted'
    | 'contact_enrolled'
    | 'contact_unenrolled'
    | 'permission_granted'
    | 'permission_revoked'
    | 'data_exported'
    | 'data_deleted';

export interface AuditLogEntry {
    action: AuditAction;
    userId: string;
    resourceType: 'mailbox' | 'email' | 'thread' | 'sequence' | 'enrollment' | 'permission';
    resourceId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

// ============================================
// AUDIT SERVICE CLASS
// ============================================

export class EmailAuditService {
    // ============================================
    // LOG ACTION
    // ============================================

    async log(entry: AuditLogEntry): Promise<void> {
        try {
            await prisma.emailAuditLog.create({
                data: {
                    action: entry.action,
                    userId: entry.userId,
                    resourceType: entry.resourceType,
                    resourceId: entry.resourceId,
                    metadata: entry.metadata || {},
                    ipAddress: entry.ipAddress,
                    userAgent: entry.userAgent,
                },
            });
        } catch (error) {
            // Log to console but don't fail the main operation
            console.error('Failed to create audit log:', error);
        }
    }

    // ============================================
    // CONVENIENCE METHODS
    // ============================================

    async logMailboxConnected(
        userId: string,
        mailboxId: string,
        provider: string,
        email: string
    ): Promise<void> {
        await this.log({
            action: 'mailbox_connected',
            userId,
            resourceType: 'mailbox',
            resourceId: mailboxId,
            metadata: { provider, email },
        });
    }

    async logMailboxDisconnected(
        userId: string,
        mailboxId: string,
        email: string
    ): Promise<void> {
        await this.log({
            action: 'mailbox_disconnected',
            userId,
            resourceType: 'mailbox',
            resourceId: mailboxId,
            metadata: { email },
        });
    }

    async logEmailSent(
        userId: string,
        emailId: string,
        metadata: {
            mailboxId: string;
            to: string[];
            subject: string;
            hasAttachments?: boolean;
            sequenceId?: string;
        }
    ): Promise<void> {
        await this.log({
            action: 'email_sent',
            userId,
            resourceType: 'email',
            resourceId: emailId,
            metadata,
        });
    }

    async logEmailOpened(
        emailId: string,
        metadata: {
            ipAddress?: string;
            userAgent?: string;
            openCount: number;
        }
    ): Promise<void> {
        // For opens, we may not have a userId, so use system
        await this.log({
            action: 'email_opened',
            userId: 'system',
            resourceType: 'email',
            resourceId: emailId,
            metadata,
            ipAddress: metadata.ipAddress,
            userAgent: metadata.userAgent,
        });
    }

    async logThreadAction(
        userId: string,
        threadId: string,
        action: 'thread_archived' | 'thread_deleted' | 'thread_assigned',
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            action,
            userId,
            resourceType: 'thread',
            resourceId: threadId,
            metadata,
        });
    }

    async logThreadLinked(
        userId: string,
        threadId: string,
        linkType: string,
        linkedEntityId: string
    ): Promise<void> {
        await this.log({
            action: 'thread_linked',
            userId,
            resourceType: 'thread',
            resourceId: threadId,
            metadata: { linkType, linkedEntityId },
        });
    }

    async logSequenceAction(
        userId: string,
        sequenceId: string,
        action: 'sequence_created' | 'sequence_activated' | 'sequence_paused' | 'sequence_deleted',
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.log({
            action,
            userId,
            resourceType: 'sequence',
            resourceId: sequenceId,
            metadata,
        });
    }

    async logEnrollmentAction(
        userId: string,
        enrollmentId: string,
        action: 'contact_enrolled' | 'contact_unenrolled',
        metadata: {
            contactId: string;
            sequenceId: string;
            reason?: string;
        }
    ): Promise<void> {
        await this.log({
            action,
            userId,
            resourceType: 'enrollment',
            resourceId: enrollmentId,
            metadata,
        });
    }

    async logPermissionChange(
        userId: string,
        permissionId: string,
        action: 'permission_granted' | 'permission_revoked',
        metadata: {
            mailboxId: string;
            targetUserId: string;
            permissions: string[];
        }
    ): Promise<void> {
        await this.log({
            action,
            userId,
            resourceType: 'permission',
            resourceId: permissionId,
            metadata,
        });
    }

    async logDataExport(
        userId: string,
        exportType: string,
        metadata: {
            format: string;
            recordCount: number;
            filters?: Record<string, unknown>;
        }
    ): Promise<void> {
        await this.log({
            action: 'data_exported',
            userId,
            resourceType: 'mailbox',
            resourceId: 'export',
            metadata: { exportType, ...metadata },
        });
    }

    // ============================================
    // QUERY AUDIT LOGS
    // ============================================

    async getAuditLogs(params: {
        userId?: string;
        resourceType?: string;
        resourceId?: string;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: Awaited<ReturnType<typeof prisma.emailAuditLog.findMany>>;
        total: number;
    }> {
        const where: Parameters<typeof prisma.emailAuditLog.findMany>[0]['where'] = {};

        if (params.userId) where.userId = params.userId;
        if (params.resourceType) where.resourceType = params.resourceType;
        if (params.resourceId) where.resourceId = params.resourceId;
        if (params.action) where.action = params.action;
        if (params.startDate || params.endDate) {
            where.createdAt = {};
            if (params.startDate) where.createdAt.gte = params.startDate;
            if (params.endDate) where.createdAt.lte = params.endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.emailAuditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: params.limit || 50,
                skip: params.offset || 0,
            }),
            prisma.emailAuditLog.count({ where }),
        ]);

        return { logs, total };
    }

    // ============================================
    // GDPR COMPLIANCE
    // ============================================

    async getDataForUser(userId: string): Promise<{
        mailboxes: unknown[];
        emails: unknown[];
        sequences: unknown[];
        auditLogs: unknown[];
    }> {
        const [mailboxes, emails, sequences, auditLogs] = await Promise.all([
            prisma.mailbox.findMany({
                where: { ownerId: userId },
                select: {
                    id: true,
                    email: true,
                    provider: true,
                    createdAt: true,
                },
            }),
            prisma.email.findMany({
                where: {
                    mailbox: { ownerId: userId },
                },
                select: {
                    id: true,
                    fromAddress: true,
                    toAddresses: true,
                    subject: true,
                    direction: true,
                    createdAt: true,
                },
            }),
            prisma.emailSequence.findMany({
                where: { createdById: userId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    createdAt: true,
                },
            }),
            prisma.emailAuditLog.findMany({
                where: { userId },
                select: {
                    id: true,
                    action: true,
                    resourceType: true,
                    createdAt: true,
                },
            }),
        ]);

        return { mailboxes, emails, sequences, auditLogs };
    }

    async deleteDataForUser(userId: string): Promise<{
        mailboxesDeleted: number;
        sequencesDeleted: number;
        auditLogsDeleted: number;
    }> {
        // Delete all user email data
        const [mailboxes, sequences, auditLogs] = await Promise.all([
            prisma.mailbox.deleteMany({
                where: { ownerId: userId },
            }),
            prisma.emailSequence.deleteMany({
                where: { createdById: userId },
            }),
            prisma.emailAuditLog.deleteMany({
                where: { userId },
            }),
        ]);

        // Log the deletion (with system user since user data is gone)
        await this.log({
            action: 'data_deleted',
            userId: 'system',
            resourceType: 'mailbox',
            resourceId: userId,
            metadata: {
                deletedUserId: userId,
                mailboxesDeleted: mailboxes.count,
                sequencesDeleted: sequences.count,
                auditLogsDeleted: auditLogs.count,
            },
        });

        return {
            mailboxesDeleted: mailboxes.count,
            sequencesDeleted: sequences.count,
            auditLogsDeleted: auditLogs.count,
        };
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const emailAuditService = new EmailAuditService();
