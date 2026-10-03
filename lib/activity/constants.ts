// ============================================
// ACTIVITY TRACKING CONSTANTS
// Centralized configuration for activity system
// ============================================

export const ACTIVITY_LIMITS = {
    // Session limits
    MAX_SESSION_HOURS: 8,
    MAX_DAILY_HOURS: 12,
    MIN_SESSION_SECONDS: 60, // Ignore sessions < 1 minute

    // Inactivity thresholds
    INACTIVITY_THRESHOLD_MS: 5 * 60 * 1000, // 5 minutes
    IDLE_WARNING_MS: 2 * 60 * 1000, // 2 minutes

    // Status thresholds (in minutes)
    ACTIVE_THRESHOLD_MINUTES: 1,
    IDLE_THRESHOLD_MINUTES: 5,
    AWAY_THRESHOLD_MINUTES: 30,

    // Heartbeat & polling
    HEARTBEAT_INTERVAL_MS: 60 * 1000, // 1 minute
    INACTIVITY_CHECK_INTERVAL_MS: 30 * 1000, // 30 seconds
    MANAGER_POLL_INTERVAL_MS: 30 * 1000, // 30 seconds
} as const;

export const ACTIVITY_MESSAGES = {
    SESSION_CAPPED: 'Session capped at maximum duration',
    SESSION_TOO_SHORT: 'Session too short to count',
    INVALID_DURATION: 'Invalid session duration',
    AUTO_PAUSED: 'Session auto-paused due to inactivity',
} as const;
