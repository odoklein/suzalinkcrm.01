// ============================================
// PROVIDER-SPECIFIC THROTTLING PROFILES
// Rate limiting configurations per email provider
// ============================================

export interface ThrottleProfile {
    maxConcurrentConnections: number;
    minDelayBetweenRequests: number;    // milliseconds
    maxFetchesPerSync: number;
    recommendedSyncInterval: number;     // milliseconds
    connectionTimeout: number;           // milliseconds
    socketTimeout: number;               // milliseconds
}

/**
 * Provider-specific throttle profiles based on documented rate limits
 * and real-world behavior observations
 */
export const THROTTLE_PROFILES: Record<string, ThrottleProfile> = {
    // Titan (Hostinger, shared infrastructure) - Very conservative
    titan: {
        maxConcurrentConnections: 1,
        minDelayBetweenRequests: 2000,      // 2s between IMAP commands
        maxFetchesPerSync: 20,
        recommendedSyncInterval: 600000,     // 10 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },

    // Gmail - Generous but respect quotas
    gmail: {
        maxConcurrentConnections: 3,
        minDelayBetweenRequests: 100,
        maxFetchesPerSync: 100,
        recommendedSyncInterval: 300000,     // 5 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },

    // Outlook/Microsoft 365 - Moderate limits
    outlook: {
        maxConcurrentConnections: 3,
        minDelayBetweenRequests: 200,
        maxFetchesPerSync: 50,
        recommendedSyncInterval: 300000,     // 5 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },

    // Yahoo - Conservative
    yahoo: {
        maxConcurrentConnections: 1,
        minDelayBetweenRequests: 1000,
        maxFetchesPerSync: 30,
        recommendedSyncInterval: 600000,     // 10 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },

    // iCloud - Conservative
    icloud: {
        maxConcurrentConnections: 1,
        minDelayBetweenRequests: 1000,
        maxFetchesPerSync: 30,
        recommendedSyncInterval: 600000,     // 10 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },

    // Default for unknown providers
    default: {
        maxConcurrentConnections: 2,
        minDelayBetweenRequests: 500,
        maxFetchesPerSync: 30,
        recommendedSyncInterval: 300000,     // 5 minutes
        connectionTimeout: 30000,
        socketTimeout: 60000,
    },
};

/**
 * Detect provider from IMAP host or email domain
 */
export function detectProvider(imapHost?: string, email?: string): string {
    const host = imapHost?.toLowerCase() || '';
    const domain = email?.split('@')[1]?.toLowerCase() || '';

    if (host.includes('titan') || host.includes('hostinger')) return 'titan';
    if (host.includes('gmail') || domain === 'gmail.com') return 'gmail';
    if (host.includes('outlook') || host.includes('office365') || domain.includes('outlook')) return 'outlook';
    if (host.includes('yahoo') || domain.includes('yahoo')) return 'yahoo';
    if (host.includes('icloud') || domain === 'icloud.com') return 'icloud';

    return 'default';
}

/**
 * Get throttle profile for a provider
 */
export function getProfile(providerHint?: string, imapHost?: string, email?: string): ThrottleProfile {
    // Use explicit hint first
    if (providerHint && THROTTLE_PROFILES[providerHint]) {
        return THROTTLE_PROFILES[providerHint];
    }

    // Auto-detect from host/email
    const detected = detectProvider(imapHost, email);
    return THROTTLE_PROFILES[detected];
}

/**
 * Apply delay between requests based on profile
 */
export async function throttleDelay(profile: ThrottleProfile): Promise<void> {
    if (profile.minDelayBetweenRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, profile.minDelayBetweenRequests));
    }
}
