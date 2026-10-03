// ============================================
// EMAIL ERROR TAXONOMY
// Standardized error classification for IMAP/SMTP operations
// ============================================

export type ErrorCategory =
    | 'AUTH_EXPIRED'           // Token needs refresh
    | 'AUTH_INVALID'           // Credentials wrong, requires re-auth
    | 'RATE_LIMITED'           // Temporary, back off and retry
    | 'CONNECTION_TIMEOUT'     // Connection took too long
    | 'CONNECTION_REFUSED'     // Server refused connection
    | 'MAILBOX_NOT_FOUND'      // Folder doesn't exist
    | 'RECIPIENT_INVALID'      // Bad email address (permanent)
    | 'MESSAGE_TOO_LARGE'      // Attachment/body too big
    | 'QUOTA_EXCEEDED'         // Storage/send quota full
    | 'PROVIDER_ERROR'         // Provider-side issue
    | 'TLS_ERROR'              // SSL/TLS handshake failed
    | 'PARSE_ERROR'            // Message parsing failed
    | 'UNKNOWN';               // Unclassified error

export interface ClassifiedError {
    category: ErrorCategory;
    isRetryable: boolean;
    requiresReauth: boolean;
    shouldDisableMailbox: boolean;
    suggestedDelayMs: number;      // How long to wait before retry
    message: string;
    originalError?: Error;
}

/**
 * Classify an error into a standardized category with retry guidance
 */
export function classifyError(error: Error, provider?: string): ClassifiedError {
    const msg = error.message.toLowerCase();
    const name = error.name?.toLowerCase() || '';

    // Authentication errors
    if (
        msg.includes('invalid credentials') ||
        msg.includes('authentication failed') ||
        msg.includes('auth failed') ||
        msg.includes('login failed') ||
        msg.includes('incorrect password')
    ) {
        return {
            category: 'AUTH_INVALID',
            isRetryable: false,
            requiresReauth: true,
            shouldDisableMailbox: true,
            suggestedDelayMs: 0,
            message: 'Authentication failed - invalid credentials',
            originalError: error,
        };
    }

    if (
        msg.includes('token expired') ||
        msg.includes('refresh token') ||
        msg.includes('access_token') ||
        msg.includes('unauthorized')
    ) {
        return {
            category: 'AUTH_EXPIRED',
            isRetryable: false,
            requiresReauth: true,
            shouldDisableMailbox: false,
            suggestedDelayMs: 0,
            message: 'Authentication token expired - needs refresh',
            originalError: error,
        };
    }

    // Rate limiting
    if (
        msg.includes('too many') ||
        msg.includes('rate limit') ||
        msg.includes('throttl') ||
        msg.includes('try again later') ||
        msg.includes('overloaded')
    ) {
        return {
            category: 'RATE_LIMITED',
            isRetryable: true,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 60000, // 1 minute
            message: 'Rate limited by provider',
            originalError: error,
        };
    }

    // Connection timeouts
    if (
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('etimedout') ||
        name.includes('timeout')
    ) {
        return {
            category: 'CONNECTION_TIMEOUT',
            isRetryable: true,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 30000, // 30 seconds
            message: 'Connection timeout',
            originalError: error,
        };
    }

    // Connection refused
    if (
        msg.includes('econnrefused') ||
        msg.includes('connection refused') ||
        msg.includes('econnreset') ||
        msg.includes('connection reset')
    ) {
        return {
            category: 'CONNECTION_REFUSED',
            isRetryable: true,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 60000, // 1 minute
            message: 'Connection refused or reset',
            originalError: error,
        };
    }

    // TLS/SSL errors
    if (
        msg.includes('ssl') ||
        msg.includes('tls') ||
        msg.includes('certificate') ||
        msg.includes('handshake')
    ) {
        return {
            category: 'TLS_ERROR',
            isRetryable: true,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 10000,
            message: 'TLS/SSL connection error',
            originalError: error,
        };
    }

    // Permanent recipient errors
    if (
        msg.includes('user unknown') ||
        msg.includes('invalid recipient') ||
        msg.includes('does not exist') ||
        msg.includes('no such user') ||
        msg.includes('mailbox not found')
    ) {
        return {
            category: 'RECIPIENT_INVALID',
            isRetryable: false,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 0,
            message: 'Invalid recipient address',
            originalError: error,
        };
    }

    // Message size errors
    if (
        msg.includes('too large') ||
        msg.includes('size limit') ||
        msg.includes('exceeded maximum')
    ) {
        return {
            category: 'MESSAGE_TOO_LARGE',
            isRetryable: false,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 0,
            message: 'Message or attachment too large',
            originalError: error,
        };
    }

    // Quota errors
    if (
        msg.includes('quota') ||
        msg.includes('storage full') ||
        msg.includes('over limit')
    ) {
        return {
            category: 'QUOTA_EXCEEDED',
            isRetryable: false,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 0,
            message: 'Quota exceeded',
            originalError: error,
        };
    }

    // Parse errors
    if (
        msg.includes('parse') ||
        msg.includes('invalid format') ||
        msg.includes('malformed')
    ) {
        return {
            category: 'PARSE_ERROR',
            isRetryable: false,
            requiresReauth: false,
            shouldDisableMailbox: false,
            suggestedDelayMs: 0,
            message: 'Message parsing error',
            originalError: error,
        };
    }

    // Default: unknown error, assume transient
    return {
        category: 'UNKNOWN',
        isRetryable: true,
        requiresReauth: false,
        shouldDisableMailbox: false,
        suggestedDelayMs: 30000,
        message: error.message,
        originalError: error,
    };
}

/**
 * Check if an error should trigger a retry
 */
export function shouldRetry(classified: ClassifiedError, attemptNumber: number, maxAttempts: number = 3): boolean {
    if (!classified.isRetryable) return false;
    if (attemptNumber >= maxAttempts) return false;
    return true;
}

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoff(attemptNumber: number, baseDelayMs: number = 10000): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attemptNumber - 1);
    const jitter = Math.random() * 5000; // Up to 5 seconds of jitter
    return Math.min(exponentialDelay + jitter, 300000); // Cap at 5 minutes
}
