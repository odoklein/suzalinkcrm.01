// ============================================
// EMAIL SERVICES - EXPORTS
// ============================================

export { emailSyncService, EmailSyncService } from './sync-service';
export type { SyncJobResult, MailboxSyncOptions } from './sync-service';

export { emailSendingService, EmailSendingService } from './sending-service';
export type { SendOptions, SendResult } from './sending-service';

export { sequenceService, SequenceService } from './sequence-service';
export type { EnrollContactParams, ProcessResult } from './sequence-service';

export { crmLinkingService, CrmLinkingService } from './linking-service';
export type { LinkingResult, LinkingConfig } from './linking-service';

export { emailAIService, EmailAIService } from './ai-service';
export type { 
    SentimentAnalysis, 
    PriorityClassification, 
    ThreadSummary, 
    ReplySuggestion,
    EmailRiskAssessment,
} from './ai-service';

export { emailAuditService, EmailAuditService } from './audit-service';
export type { AuditAction, AuditLogEntry } from './audit-service';
