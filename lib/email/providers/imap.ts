// ============================================
// IMAP/SMTP CUSTOM PROVIDER IMPLEMENTATION
// For self-hosted or non-OAuth email providers
// ============================================

import { EmailProvider } from '@prisma/client';
import {
    IEmailProvider,
    OAuthTokens,
    SyncOptions,
    SyncResult,
    EmailThreadData,
    EmailMessageData,
    EmailAddress,
    SendEmailParams,
    SendResult,
    DraftParams,
    Draft,
    WebhookConfig,
    WebhookPayload,
} from './types';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { getProfile, ThrottleProfile, throttleDelay } from '../utils/throttle-profiles';
import { classifyError, ClassifiedError } from '../utils/error-taxonomy';

// ============================================
// IMAP PROVIDER CONFIGURATION
// ============================================

export interface ImapConfig {
    email: string;
    password: string;
    imapHost: string;
    imapPort: number;
    smtpHost: string;
    smtpPort: number;
    secure?: boolean;
}

// ============================================
// IMAP PROVIDER CLASS
// ============================================

export class ImapProvider implements IEmailProvider {
    provider: EmailProvider = 'CUSTOM';
    private config: ImapConfig | null = null;

    constructor(config?: ImapConfig) {
        if (config) {
            this.config = config;
        }
    }

    // ============================================
    // CONFIGURATION
    // ============================================

    setConfig(config: ImapConfig): void {
        this.config = config;
    }

    private ensureConfig(): ImapConfig {
        if (!this.config) {
            throw new Error('IMAP configuration not set');
        }
        return this.config;
    }

    // ============================================
    // IMAP CLIENT FACTORY
    // ============================================

    private getThrottleProfile(): ThrottleProfile {
        const config = this.ensureConfig();
        return getProfile(undefined, config.imapHost, config.email);
    }

    private async createImapClient(): Promise<ImapFlow> {
        const config = this.ensureConfig();
        const profile = this.getThrottleProfile();

        const client = new ImapFlow({
            host: config.imapHost,
            port: config.imapPort,
            secure: config.imapPort === 993,
            auth: {
                user: config.email,
                pass: config.password,
            },
            logger: false,
            // Connection lifecycle controls
            connectionTimeout: profile.connectionTimeout,
            greetingTimeout: profile.connectionTimeout,
            socketTimeout: profile.socketTimeout,
            // TLS compatibility for problematic providers
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2',
            },
        });

        await client.connect();
        return client;
    }

    /**
     * Execute an operation with a managed IMAP connection
     * Ensures connection is always closed, even on errors
     */
    private async withConnection<T>(
        operation: (client: ImapFlow) => Promise<T>,
        maxDurationMs: number = 120000
    ): Promise<T> {
        const client = await this.createImapClient();

        // Force disconnect after max duration to prevent hung connections
        const timeout = setTimeout(() => {
            console.warn('[IMAP] Force disconnecting due to timeout');
            client.logout().catch(() => { });
        }, maxDurationMs);

        try {
            return await operation(client);
        } finally {
            clearTimeout(timeout);
            await client.logout().catch(() => { });
        }
    }

    // ============================================
    // AUTHENTICATION (Not OAuth - password based)
    // ============================================

    getAuthUrl(_state?: string): string {
        return '';
    }

    async handleCallback(_code: string): Promise<OAuthTokens> {
        throw new Error('IMAP provider does not support OAuth');
    }

    async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
        throw new Error('IMAP provider does not support token refresh');
    }

    async validateTokens(_tokens: OAuthTokens): Promise<boolean> {
        // For IMAP, we can't validate tokens, we would need to try connecting
        return true;
    }

    // ============================================
    // EMAIL SYNC VIA IMAP
    // ============================================

    async syncMailbox(
        _tokens: OAuthTokens,
        options: SyncOptions = {}
    ): Promise<{ threads: EmailThreadData[]; syncResult: SyncResult }> {
        const config = this.ensureConfig();
        let client: ImapFlow | null = null;
        const threads: EmailThreadData[] = [];
        let threadsAdded = 0;
        let messagesAdded = 0;
        const errors: string[] = [];

        try {
            client = await this.createImapClient();

            // Select INBOX
            const mailbox = await client.getMailboxLock('INBOX');

            try {
                // Calculate search criteria
                const searchCriteria: any = {};

                if (options.since) {
                    searchCriteria.since = options.since;
                } else if (!options.fullSync) {
                    // Default: last 7 days
                    const since = new Date();
                    since.setDate(since.getDate() - 7);
                    searchCriteria.since = since;
                }

                // Search for messages
                const messageUids = await client.search(searchCriteria, { uid: true });

                // Limit results
                const maxResults = options.maxResults || 50;
                const uidsToFetch = Array.isArray(messageUids) ? messageUids.slice(-maxResults) : [];

                if (uidsToFetch.length === 0) {
                    return {
                        threads: [],
                        syncResult: {
                            success: true,
                            threadsAdded: 0,
                            threadsUpdated: 0,
                            messagesAdded: 0,
                            messagesUpdated: 0,
                        },
                    };
                }

                // Group messages by thread (using In-Reply-To / References)
                const messagesByThread = new Map<string, EmailMessageData[]>();

                for await (const message of client.fetch(uidsToFetch, {
                    envelope: true,
                    source: true,
                    flags: true,
               }, { uid: true })) {

                    try {
                        // Parse the email - ensure source exists
                        if (!message.source) {
                            console.warn(`[IMAP] Message ${message.uid} has no source`);
                            continue;
                        }
                        const parsed = await simpleParser(message.source);

                        // Get thread ID from Message-ID or create one
                        const threadId = this.getThreadId(parsed);

                        const emailData = this.parseMailToEmailData(
                            message.uid.toString(),
                            threadId,
                            parsed,
                            message.flags || new Set<string>()
                        );

                        if (!messagesByThread.has(threadId)) {
                            messagesByThread.set(threadId, []);
                        }
                        messagesByThread.get(threadId)!.push(emailData);
                    } catch (parseError) {
                        console.error(`[IMAP] Failed to parse message ${message.uid}:`, parseError);
                    }
                }

                // Convert to ThreadData
                for (const [threadId, messages] of messagesByThread) {
                    // Sort messages by date
                    messages.sort((a, b) =>
                        (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
                    );

                    const lastMessage = messages[messages.length - 1];
                    const firstMessage = messages[0];

                    // Get all participants
                    const participants: EmailAddress[] = [];
                    const seenEmails = new Set<string>();

                    for (const msg of messages) {
                        if (!seenEmails.has(msg.from.email)) {
                            participants.push(msg.from);
                            seenEmails.add(msg.from.email);
                        }
                        for (const to of msg.to) {
                            if (!seenEmails.has(to.email)) {
                                participants.push(to);
                                seenEmails.add(to.email);
                            }
                        }
                    }

                    threads.push({
                        id: threadId,
                        subject: firstMessage.subject,
                        snippet: lastMessage.bodyText?.substring(0, 200) || '',
                        participants,
                        messages,
                        lastMessageAt: lastMessage.date || new Date(),
                        isRead: !messages.some(m => !m.isRead),
                        isStarred: messages.some(m => m.isStarred),
                        labels: [],
                    });
                    threadsAdded++;
                    messagesAdded += messages.length;
                }

                return {
                    threads,
                    syncResult: {
                        success: true,
                        threadsAdded,
                        threadsUpdated: 0,
                        messagesAdded,
                        messagesUpdated: 0,
                        nextPageToken: Array.isArray(messageUids) && messageUids.length > maxResults ? 'more' : undefined,
                    },
                };
            } finally {
                mailbox.release();
            }
        } catch (error) {
            console.error('[IMAP] Sync error:', error);
            errors.push(error instanceof Error ? error.message : String(error));
            return {
                threads,
                syncResult: {
                    success: false,
                    threadsAdded,
                    threadsUpdated: 0,
                    messagesAdded,
                    messagesUpdated: 0,
                    errors,
                },
            };
        } finally {
            if (client) {
                await client.logout().catch(() => { });
            }
        }
    }

    private getThreadId(parsed: ParsedMail): string {
        // Try to extract thread ID from References or In-Reply-To
        if (parsed.references && parsed.references.length > 0) {
            // Use the first reference as thread ID
            return typeof parsed.references === 'string'
                ? parsed.references
                : parsed.references[0];
        }
        if (parsed.inReplyTo) {
            return parsed.inReplyTo;
        }
        // Use Message-ID as fallback
        return parsed.messageId || `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private parseMailToEmailData(
        uid: string,
        threadId: string,
        parsed: ParsedMail,
        flags: Set<string>
    ): EmailMessageData {
        // Helper to extract addresses from AddressObject or array
        const extractAddresses = (addr: typeof parsed.to): { email: string; name?: string }[] => {
            if (!addr) return [];
            if (Array.isArray(addr)) {
                return addr.flatMap(a => a.value?.map(v => ({ email: v.address || '', name: v.name })) || []);
            }
            return addr.value?.map(v => ({ email: v.address || '', name: v.name })) || [];
        };

        const from: EmailAddress = parsed.from?.value?.[0]
            ? { email: parsed.from.value[0].address || '', name: parsed.from.value[0].name }
            : { email: 'unknown', name: undefined };

        const to: EmailAddress[] = extractAddresses(parsed.to);
        const cc: EmailAddress[] = extractAddresses(parsed.cc);

        return {
            id: uid,
            threadId,
            from,
            to,
            cc,
            subject: parsed.subject || '(Sans sujet)',
            bodyText: parsed.text || '',
            bodyHtml: parsed.html || parsed.textAsHtml || '',
            date: parsed.date || new Date(),
            isRead: flags.has('\\Seen'),
            isStarred: flags.has('\\Flagged'),
            attachments: parsed.attachments?.map((att: { checksum?: string; filename?: string; contentType?: string; size?: number }) => ({
                id: att.checksum || `att-${Date.now()}`,
                filename: att.filename || 'attachment',
                mimeType: att.contentType || 'application/octet-stream',
                size: att.size || 0,
            })),
        };
    }

    async getThread(
        _tokens: OAuthTokens,
        threadId: string
    ): Promise<EmailThreadData | null> {
        // For IMAP, we would need to search by Message-ID
        // This is simplified - in production, you'd search across all mailboxes
        console.log(`[IMAP] Get thread: ${threadId}`);
        return null;
    }

    async getMessage(
        _tokens: OAuthTokens,
        messageId: string
    ): Promise<EmailMessageData | null> {
        console.log(`[IMAP] Get message: ${messageId}`);
        return null;
    }

    // ============================================
    // SEND EMAIL (via SMTP)
    // ============================================

    async sendEmail(
        _tokens: OAuthTokens,
        params: SendEmailParams
    ): Promise<SendResult> {
        const config = this.ensureConfig();

        try {
            // Create transporter
            const transporter = nodemailer.createTransport({
                host: config.smtpHost,
                port: config.smtpPort,
                secure: config.smtpPort === 465,
                auth: {
                    user: config.email,
                    pass: config.password,
                },
            });

            // Build email
            const mailOptions: nodemailer.SendMailOptions = {
                from: params.from?.email || config.email,
                to: params.to.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', '),
                subject: params.subject,
                html: params.bodyHtml,
                text: params.bodyText,
            };

            if (params.cc?.length) {
                mailOptions.cc = params.cc.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ');
            }

            if (params.bcc?.length) {
                mailOptions.bcc = params.bcc.map(r => r.name ? `"${r.name}" <${r.email}>` : r.email).join(', ');
            }

            if (params.inReplyTo) {
                mailOptions.inReplyTo = params.inReplyTo;
                mailOptions.references = params.inReplyTo;
            }

            if (params.attachments?.length) {
                mailOptions.attachments = params.attachments.map(att => ({
                    filename: att.filename,
                    content: att.content,
                    contentType: att.mimeType,
                }));
            }

            // Send
            const result = await transporter.sendMail(mailOptions);

            return {
                success: true,
                messageId: result.messageId,
                threadId: params.threadId,
            };
        } catch (error) {
            console.error('[IMAP] Send email error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to send email',
            };
        }
    }

    // ============================================
    // DRAFTS (Not fully supported for IMAP)
    // ============================================

    async saveDraft(
        _tokens: OAuthTokens,
        _params: DraftParams
    ): Promise<Draft> {
        // IMAP doesn't support drafts in the same way - throw not implemented
        throw new Error('saveDraft is not supported for IMAP provider');
    }

    async updateDraft(
        _tokens: OAuthTokens,
        _draftId: string,
        _params: Partial<DraftParams>
    ): Promise<Draft> {
        // IMAP doesn't support drafts in the same way - throw not implemented
        throw new Error('updateDraft is not supported for IMAP provider');
    }

    async deleteDraft(
        _tokens: OAuthTokens,
        _draftId: string
    ): Promise<boolean> {
        return false;
    }

    // ============================================
    // MESSAGE ACTIONS
    // ============================================

    async markAsRead(
        _tokens: OAuthTokens,
        messageIds: string[]
    ): Promise<void> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');
            try {
                for (const messageId of messageIds) {
                    await client.messageFlagsAdd(messageId, ['\\Seen'], { uid: true });
                }
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`[IMAP] Mark as read error:`, error);
            throw error;
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    async markAsUnread(
        _tokens: OAuthTokens,
        messageIds: string[]
    ): Promise<void> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');
            try {
                for (const messageId of messageIds) {
                    await client.messageFlagsRemove(messageId, ['\\Seen'], { uid: true });
                }
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`[IMAP] Mark as unread error:`, error);
            throw error;
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    async archive(
        _tokens: OAuthTokens,
        messageIds: string[]
    ): Promise<void> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');
            try {
                for (const messageId of messageIds) {
                    try {
                        // Move to Archive or All Mail folder
                        await client.messageMove(messageId, 'Archive', { uid: true });
                    } catch {
                        // Try alternative folder name
                        try {
                            await client.messageMove(messageId, '[Gmail]/All Mail', { uid: true });
                        } catch {
                            console.warn(`[IMAP] Could not archive message ${messageId}`);
                        }
                    }
                }
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`[IMAP] Archive error:`, error);
            throw error;
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    async trash(
        _tokens: OAuthTokens,
        messageIds: string[]
    ): Promise<void> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');
            try {
                for (const messageId of messageIds) {
                    try {
                        await client.messageMove(messageId, 'Trash', { uid: true });
                    } catch {
                        try {
                            await client.messageMove(messageId, '[Gmail]/Trash', { uid: true });
                        } catch {
                            // Mark as deleted instead
                            await client.messageFlagsAdd(messageId, ['\\Deleted'], { uid: true });
                        }
                    }
                }
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`[IMAP] Trash error:`, error);
            throw error;
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    async star(
        _tokens: OAuthTokens,
        messageIds: string[],
        starred: boolean
    ): Promise<void> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');
            try {
                for (const messageId of messageIds) {
                    if (starred) {
                        await client.messageFlagsAdd(messageId, ['\\Flagged'], { uid: true });
                    } else {
                        await client.messageFlagsRemove(messageId, ['\\Flagged'], { uid: true });
                    }
                }
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error(`[IMAP] Star error:`, error);
            throw error;
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    // ============================================
    // WEBHOOKS (Not supported for IMAP)
    // ============================================

    async setupWebhook(
        _tokens: OAuthTokens,
        _callbackUrl: string
    ): Promise<WebhookConfig> {
        // IMAP doesn't support webhooks - throw not implemented
        throw new Error('Webhooks are not supported for IMAP provider');
    }

    async stopWebhook(
        _tokens: OAuthTokens,
        _webhookId: string
    ): Promise<void> {
        // IMAP doesn't support webhooks - no-op
    }

    parseWebhookPayload(_payload: unknown): WebhookPayload | null {
        return null;
    }

    // ============================================
    // USER INFO
    // ============================================

    async getUserProfile(_tokens: OAuthTokens): Promise<{
        email: string;
        name?: string;
        picture?: string;
    }> {
        const config = this.ensureConfig();
        return {
            email: config.email,
            name: config.email.split('@')[0],
        };
    }

    // ============================================
    // SEARCH
    // ============================================

    async search(
        _tokens: OAuthTokens,
        query: string,
        options?: { maxResults?: number; pageToken?: string }
    ): Promise<{ threads: EmailThreadData[]; nextPageToken?: string }> {
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            const lock = await client.getMailboxLock('INBOX');

            try {
                // Search by subject or body containing query
                const uids = await client.search({
                    or: [
                        { subject: query },
                        { body: query },
                        { from: query },
                    ]
                }, { uid: true });

                const maxResults = options?.maxResults || 20;
                const limitedUids = Array.isArray(uids) ? uids.slice(-maxResults) : [];

                if (limitedUids.length === 0) return { threads: [] };

                const threads: EmailThreadData[] = [];

                for await (const message of client.fetch(limitedUids, {
                    uid: true,
                    envelope: true,
                    source: true,
                    flags: true,
                })) {
                    try {
                        if (!message.source) {
                            console.warn(`[IMAP] Search message ${message.uid} has no source`);
                            continue;
                        }
                        const parsed = await simpleParser(message.source);
                        const threadId = this.getThreadId(parsed);
                        const emailData = this.parseMailToEmailData(
                            message.uid.toString(),
                            threadId,
                            parsed,
                            message.flags || new Set<string>()
                        );

                        threads.push({
                            id: threadId,
                            subject: emailData.subject,
                            snippet: emailData.bodyText?.substring(0, 200) || '',
                            participants: [emailData.from, ...emailData.to],
                            messages: [emailData],
                            lastMessageAt: emailData.date || new Date(),
                            isRead: emailData.isRead || false,
                            isStarred: emailData.isStarred || false,
                            labels: [],
                        });
                    } catch (parseError) {
                        console.error(`[IMAP] Search parse error:`, parseError);
                    }
                }

                return { threads };
            } finally {
                lock.release();
            }
        } catch (error) {
            console.error('[IMAP] Search error:', error);
            return { threads: [] };
        } finally {
            if (client) await client.logout().catch(() => { });
        }
    }

    // ============================================
    // CONNECTION TEST
    // ============================================

    async testConnection(): Promise<{
        success: boolean;
        error?: string;
        imapOk?: boolean;
        smtpOk?: boolean;
    }> {
        const config = this.ensureConfig();
        let imapOk = false;
        let smtpOk = false;
        const errors: string[] = [];

        // Test IMAP
        let client: ImapFlow | null = null;
        try {
            client = await this.createImapClient();
            imapOk = true;
        } catch (error) {
            errors.push(`IMAP: ${error instanceof Error ? error.message : 'Connection failed'}`);
        } finally {
            if (client) await client.logout().catch(() => { });
        }

        // Test SMTP
        try {
            const transporter = nodemailer.createTransport({
                host: config.smtpHost,
                port: config.smtpPort,
                secure: config.smtpPort === 465,
                auth: {
                    user: config.email,
                    pass: config.password,
                },
            });

            await transporter.verify();
            smtpOk = true;
        } catch (error) {
            errors.push(`SMTP: ${error instanceof Error ? error.message : 'Connection failed'}`);
        }

        return {
            success: imapOk && smtpOk,
            error: errors.length > 0 ? errors.join('; ') : undefined,
            imapOk,
            smtpOk,
        };
    }
}

// Export singleton
export const imapProvider = new ImapProvider();
