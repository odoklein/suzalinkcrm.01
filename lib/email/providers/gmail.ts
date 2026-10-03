// ============================================
// GMAIL PROVIDER IMPLEMENTATION
// ============================================

import { google, gmail_v1 } from 'googleapis';
import { EmailProvider } from '@prisma/client';
import {
    IEmailProvider,
    OAuthTokens,
    SyncOptions,
    SyncResult,
    EmailThreadData,
    EmailMessageData,
    EmailAddress,
    EmailAttachmentData,
    SendEmailParams,
    SendResult,
    DraftParams,
    Draft,
    WebhookConfig,
    WebhookPayload,
    getProviderConfig,
} from './types';

// ============================================
// CONSTANTS
// ============================================

const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];

// ============================================
// GMAIL PROVIDER CLASS
// ============================================

export class GmailProvider implements IEmailProvider {
    provider: EmailProvider = 'GMAIL';
    private oauth2Client;
    private config;

    constructor() {
        this.config = getProviderConfig().gmail;
        this.oauth2Client = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            this.config.redirectUri
        );
    }

    // ============================================
    // HELPER: Get authenticated Gmail client
    // ============================================

    private getGmailClient(tokens: OAuthTokens): gmail_v1.Gmail {
        const oauth2 = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            this.config.redirectUri
        );
        
        oauth2.setCredentials({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            expiry_date: tokens.expiresAt?.getTime(),
        });

        return google.gmail({ version: 'v1', auth: oauth2 });
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    getAuthUrl(state?: string): string {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: GMAIL_SCOPES,
            prompt: 'consent',
            state: state,
        });
    }

    async handleCallback(code: string): Promise<OAuthTokens> {
        const { tokens } = await this.oauth2Client.getToken(code);
        
        return {
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            scope: tokens.scope,
            tokenType: tokens.token_type,
        };
    }

    async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
        this.oauth2Client.setCredentials({
            refresh_token: refreshToken,
        });

        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        return {
            accessToken: credentials.access_token!,
            refreshToken: credentials.refresh_token || refreshToken,
            expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
            scope: credentials.scope,
            tokenType: credentials.token_type,
        };
    }

    async validateTokens(tokens: OAuthTokens): Promise<boolean> {
        try {
            const gmail = this.getGmailClient(tokens);
            await gmail.users.getProfile({ userId: 'me' });
            return true;
        } catch {
            return false;
        }
    }

    // ============================================
    // SYNC OPERATIONS
    // ============================================

    async syncMailbox(
        tokens: OAuthTokens,
        options: SyncOptions = {}
    ): Promise<{ threads: EmailThreadData[]; syncResult: SyncResult }> {
        const gmail = this.getGmailClient(tokens);
        const threads: EmailThreadData[] = [];
        const errors: string[] = [];
        
        let threadsAdded = 0;
        let messagesAdded = 0;

        try {
            // List threads
            const response = await gmail.users.threads.list({
                userId: 'me',
                maxResults: options.maxResults || 50,
                pageToken: options.pageToken,
                q: options.since ? `after:${Math.floor(options.since.getTime() / 1000)}` : undefined,
            });

            const threadList = response.data.threads || [];

            // Fetch full thread data for each thread
            for (const threadMeta of threadList) {
                if (!threadMeta.id) continue;
                
                try {
                    const threadData = await this.getThread(tokens, threadMeta.id);
                    if (threadData) {
                        threads.push(threadData);
                        threadsAdded++;
                        messagesAdded += threadData.messages.length;
                    }
                } catch (error) {
                    errors.push(`Failed to fetch thread ${threadMeta.id}: ${error}`);
                }
            }

            // Get history ID for incremental sync
            const profile = await gmail.users.getProfile({ userId: 'me' });

            return {
                threads,
                syncResult: {
                    success: true,
                    threadsAdded,
                    threadsUpdated: 0,
                    messagesAdded,
                    messagesUpdated: 0,
                    nextPageToken: response.data.nextPageToken || undefined,
                    historyId: profile.data.historyId || undefined,
                    errors: errors.length > 0 ? errors : undefined,
                },
            };
        } catch (error) {
            return {
                threads: [],
                syncResult: {
                    success: false,
                    threadsAdded: 0,
                    threadsUpdated: 0,
                    messagesAdded: 0,
                    messagesUpdated: 0,
                    errors: [`Sync failed: ${error}`],
                },
            };
        }
    }

    async getThread(tokens: OAuthTokens, threadId: string): Promise<EmailThreadData | null> {
        try {
            const gmail = this.getGmailClient(tokens);
            
            const response = await gmail.users.threads.get({
                userId: 'me',
                id: threadId,
                format: 'full',
            });

            const thread = response.data;
            if (!thread.id || !thread.messages) return null;

            const messages: EmailMessageData[] = thread.messages.map((msg) => 
                this.parseMessage(msg)
            );

            const participants = this.extractParticipants(messages);
            const lastMessage = messages[messages.length - 1];

            return {
                id: thread.id,
                subject: this.getHeader(thread.messages[0], 'Subject') || '(No Subject)',
                snippet: thread.snippet || undefined,
                participants,
                messages,
                labels: thread.messages[0]?.labelIds || [],
                isRead: !thread.messages[0]?.labelIds?.includes('UNREAD'),
                isStarred: thread.messages[0]?.labelIds?.includes('STARRED') || false,
                lastMessageAt: lastMessage.date || new Date(),
            };
        } catch (error) {
            console.error('Failed to get thread:', error);
            return null;
        }
    }

    async getMessage(tokens: OAuthTokens, messageId: string): Promise<EmailMessageData | null> {
        try {
            const gmail = this.getGmailClient(tokens);
            
            const response = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full',
            });

            return this.parseMessage(response.data);
        } catch (error) {
            console.error('Failed to get message:', error);
            return null;
        }
    }

    // ============================================
    // SEND OPERATIONS
    // ============================================

    async sendEmail(tokens: OAuthTokens, params: SendEmailParams): Promise<SendResult> {
        try {
            const gmail = this.getGmailClient(tokens);
            
            // Build raw email
            const rawEmail = this.buildRawEmail(params);
            
            const response = await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: rawEmail,
                    threadId: params.threadId,
                },
            });

            return {
                success: true,
                messageId: response.data.id || undefined,
                threadId: response.data.threadId || undefined,
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to send email: ${error}`,
            };
        }
    }

    async saveDraft(tokens: OAuthTokens, params: DraftParams): Promise<Draft> {
        const gmail = this.getGmailClient(tokens);
        
        const rawEmail = this.buildRawEmail({
            to: params.to || [],
            subject: params.subject || '',
            bodyText: params.bodyText,
            bodyHtml: params.bodyHtml,
            attachments: params.attachments,
        });

        const response = await gmail.users.drafts.create({
            userId: 'me',
            requestBody: {
                message: {
                    raw: rawEmail,
                    threadId: params.threadId,
                },
            },
        });

        return {
            id: response.data.id!,
            messageId: response.data.message?.id!,
            threadId: response.data.message?.threadId,
        };
    }

    async updateDraft(tokens: OAuthTokens, draftId: string, params: DraftParams): Promise<Draft> {
        const gmail = this.getGmailClient(tokens);
        
        const rawEmail = this.buildRawEmail({
            to: params.to || [],
            subject: params.subject || '',
            bodyText: params.bodyText,
            bodyHtml: params.bodyHtml,
            attachments: params.attachments,
        });

        const response = await gmail.users.drafts.update({
            userId: 'me',
            id: draftId,
            requestBody: {
                message: {
                    raw: rawEmail,
                    threadId: params.threadId,
                },
            },
        });

        return {
            id: response.data.id!,
            messageId: response.data.message?.id!,
            threadId: response.data.message?.threadId,
        };
    }

    async deleteDraft(tokens: OAuthTokens, draftId: string): Promise<boolean> {
        try {
            const gmail = this.getGmailClient(tokens);
            await gmail.users.drafts.delete({
                userId: 'me',
                id: draftId,
            });
            return true;
        } catch {
            return false;
        }
    }

    // ============================================
    // THREAD ACTIONS
    // ============================================

    async markAsRead(tokens: OAuthTokens, messageIds: string[]): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        
        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                removeLabelIds: ['UNREAD'],
            },
        });
    }

    async markAsUnread(tokens: OAuthTokens, messageIds: string[]): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        
        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                addLabelIds: ['UNREAD'],
            },
        });
    }

    async archive(tokens: OAuthTokens, messageIds: string[]): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        
        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                removeLabelIds: ['INBOX'],
            },
        });
    }

    async trash(tokens: OAuthTokens, messageIds: string[]): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        
        for (const messageId of messageIds) {
            await gmail.users.messages.trash({
                userId: 'me',
                id: messageId,
            });
        }
    }

    async star(tokens: OAuthTokens, messageIds: string[], starred: boolean): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        
        await gmail.users.messages.batchModify({
            userId: 'me',
            requestBody: {
                ids: messageIds,
                addLabelIds: starred ? ['STARRED'] : [],
                removeLabelIds: starred ? [] : ['STARRED'],
            },
        });
    }

    // ============================================
    // WEBHOOKS
    // ============================================

    async setupWebhook(tokens: OAuthTokens, callbackUrl: string): Promise<WebhookConfig> {
        const gmail = this.getGmailClient(tokens);
        
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: process.env.GOOGLE_PUBSUB_TOPIC || '',
                labelIds: ['INBOX'],
            },
        });

        return {
            id: response.data.historyId || '',
            expiration: response.data.expiration 
                ? new Date(parseInt(response.data.expiration)) 
                : undefined,
        };
    }

    async stopWebhook(tokens: OAuthTokens, _webhookId: string): Promise<void> {
        const gmail = this.getGmailClient(tokens);
        await gmail.users.stop({ userId: 'me' });
    }

    parseWebhookPayload(payload: unknown): WebhookPayload | null {
        try {
            const data = payload as { message?: { data?: string } };
            if (!data.message?.data) return null;
            
            const decoded = JSON.parse(
                Buffer.from(data.message.data, 'base64').toString()
            );
            
            return {
                mailboxEmail: decoded.emailAddress,
                historyId: decoded.historyId?.toString(),
            };
        } catch {
            return null;
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    async getUserProfile(tokens: OAuthTokens): Promise<{
        email: string;
        name?: string;
        picture?: string;
    }> {
        const oauth2 = new google.auth.OAuth2(
            this.config.clientId,
            this.config.clientSecret,
            this.config.redirectUri
        );
        
        oauth2.setCredentials({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        });

        const people = google.people({ version: 'v1', auth: oauth2 });
        
        const response = await people.people.get({
            resourceName: 'people/me',
            personFields: 'emailAddresses,names,photos',
        });

        const email = response.data.emailAddresses?.[0]?.value || '';
        const name = response.data.names?.[0]?.displayName;
        const picture = response.data.photos?.[0]?.url;

        return { email, name, picture };
    }

    async search(
        tokens: OAuthTokens,
        query: string,
        options?: { maxResults?: number; pageToken?: string }
    ): Promise<{ threads: EmailThreadData[]; nextPageToken?: string }> {
        const gmail = this.getGmailClient(tokens);
        const threads: EmailThreadData[] = [];

        const response = await gmail.users.threads.list({
            userId: 'me',
            q: query,
            maxResults: options?.maxResults || 20,
            pageToken: options?.pageToken,
        });

        for (const threadMeta of response.data.threads || []) {
            if (!threadMeta.id) continue;
            const threadData = await this.getThread(tokens, threadMeta.id);
            if (threadData) threads.push(threadData);
        }

        return {
            threads,
            nextPageToken: response.data.nextPageToken || undefined,
        };
    }

    // ============================================
    // PRIVATE HELPERS
    // ============================================

    private parseMessage(msg: gmail_v1.Schema$Message): EmailMessageData {
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) => 
            headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const from = this.parseEmailAddress(getHeader('From'));
        const to = this.parseEmailAddresses(getHeader('To'));
        const cc = this.parseEmailAddresses(getHeader('Cc'));
        const date = getHeader('Date');

        // Extract body
        const { bodyText, bodyHtml } = this.extractBody(msg.payload);
        
        // Extract attachments
        const attachments = this.extractAttachments(msg.payload);

        return {
            id: msg.id || undefined,
            threadId: msg.threadId || undefined,
            from,
            to,
            cc: cc.length > 0 ? cc : undefined,
            subject: getHeader('Subject') || '(No Subject)',
            bodyText,
            bodyHtml,
            attachments: attachments.length > 0 ? attachments : undefined,
            inReplyTo: getHeader('In-Reply-To') || undefined,
            references: getHeader('References')?.split(/\s+/).filter(Boolean),
            date: date ? new Date(date) : undefined,
        };
    }

    private getHeader(msg: gmail_v1.Schema$Message | undefined, name: string): string {
        if (!msg?.payload?.headers) return '';
        const header = msg.payload.headers.find(
            h => h.name?.toLowerCase() === name.toLowerCase()
        );
        return header?.value || '';
    }

    private parseEmailAddress(str: string): EmailAddress {
        const match = str.match(/(?:"?([^"]*)"?\s)?(?:<)?([^>]+@[^>]+)(?:>)?/);
        if (match) {
            return {
                name: match[1]?.trim(),
                email: match[2].trim(),
            };
        }
        return { email: str.trim() };
    }

    private parseEmailAddresses(str: string): EmailAddress[] {
        if (!str) return [];
        return str.split(',').map(s => this.parseEmailAddress(s.trim())).filter(a => a.email);
    }

    private extractParticipants(messages: EmailMessageData[]): EmailAddress[] {
        const seen = new Set<string>();
        const participants: EmailAddress[] = [];

        for (const msg of messages) {
            const addresses = [msg.from, ...msg.to, ...(msg.cc || [])];
            for (const addr of addresses) {
                if (!seen.has(addr.email.toLowerCase())) {
                    seen.add(addr.email.toLowerCase());
                    participants.push(addr);
                }
            }
        }

        return participants;
    }

    private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): {
        bodyText?: string;
        bodyHtml?: string;
    } {
        if (!payload) return {};

        let bodyText: string | undefined;
        let bodyHtml: string | undefined;

        const extractPart = (part: gmail_v1.Schema$MessagePart) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/html' && part.body?.data) {
                bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.parts) {
                part.parts.forEach(extractPart);
            }
        };

        extractPart(payload);

        return { bodyText, bodyHtml };
    }

    private extractAttachments(
        payload: gmail_v1.Schema$MessagePart | undefined
    ): EmailAttachmentData[] {
        const attachments: EmailAttachmentData[] = [];

        const extractPart = (part: gmail_v1.Schema$MessagePart) => {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || 'application/octet-stream',
                    size: part.body.size || 0,
                    contentId: part.headers?.find(h => h.name === 'Content-ID')?.value,
                });
            }
            if (part.parts) {
                part.parts.forEach(extractPart);
            }
        };

        if (payload) extractPart(payload);

        return attachments;
    }

    private buildRawEmail(params: SendEmailParams): string {
        const boundary = `boundary_${Date.now()}`;
        const lines: string[] = [];

        // Headers
        if (params.to.length > 0) {
            lines.push(`To: ${params.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')}`);
        }
        if (params.cc && params.cc.length > 0) {
            lines.push(`Cc: ${params.cc.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')}`);
        }
        if (params.bcc && params.bcc.length > 0) {
            lines.push(`Bcc: ${params.bcc.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ')}`);
        }
        lines.push(`Subject: ${params.subject}`);
        
        if (params.inReplyTo) {
            lines.push(`In-Reply-To: ${params.inReplyTo}`);
            lines.push(`References: ${params.inReplyTo}`);
        }

        // Content type
        if (params.attachments && params.attachments.length > 0) {
            lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
            lines.push('');
            lines.push(`--${boundary}`);
        }

        if (params.bodyHtml && params.bodyText) {
            const altBoundary = `alt_${Date.now()}`;
            lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
            lines.push('');
            lines.push(`--${altBoundary}`);
            lines.push('Content-Type: text/plain; charset="UTF-8"');
            lines.push('');
            lines.push(params.bodyText);
            lines.push(`--${altBoundary}`);
            lines.push('Content-Type: text/html; charset="UTF-8"');
            lines.push('');
            lines.push(params.bodyHtml);
            lines.push(`--${altBoundary}--`);
        } else if (params.bodyHtml) {
            lines.push('Content-Type: text/html; charset="UTF-8"');
            lines.push('');
            lines.push(params.bodyHtml);
        } else {
            lines.push('Content-Type: text/plain; charset="UTF-8"');
            lines.push('');
            lines.push(params.bodyText || '');
        }

        // Attachments
        if (params.attachments) {
            for (const attachment of params.attachments) {
                if (attachment.content) {
                    lines.push(`--${boundary}`);
                    lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
                    lines.push('Content-Transfer-Encoding: base64');
                    lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
                    lines.push('');
                    lines.push(attachment.content.toString('base64'));
                }
            }
            lines.push(`--${boundary}--`);
        }

        const rawEmail = lines.join('\r\n');
        return Buffer.from(rawEmail).toString('base64url');
    }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const gmailProvider = new GmailProvider();
