// ============================================
// ACTIVITY VALIDATORS
// Data validation and quality checks
// ============================================

import { ACTIVITY_LIMITS, ACTIVITY_MESSAGES } from './constants';

export interface SessionValidationResult {
    valid: boolean;
    reason?: string;
    cappedDurationSeconds?: number;
    originalDurationSeconds?: number;
}

/**
 * Validate session duration and apply caps if needed
 */
export function validateSession(
    startTime: Date,
    endTime: Date = new Date()
): SessionValidationResult {
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationSeconds = Math.floor(durationMs / 1000);
    const durationHours = durationMs / 3600000;

    // Check for negative duration
    if (durationMs < 0) {
        return {
            valid: false,
            reason: ACTIVITY_MESSAGES.INVALID_DURATION,
        };
    }

    // Check minimum duration
    if (durationSeconds < ACTIVITY_LIMITS.MIN_SESSION_SECONDS) {
        return {
            valid: false,
            reason: ACTIVITY_MESSAGES.SESSION_TOO_SHORT,
        };
    }

    // Check maximum duration and cap if needed
    if (durationHours > ACTIVITY_LIMITS.MAX_SESSION_HOURS) {
        const cappedSeconds = ACTIVITY_LIMITS.MAX_SESSION_HOURS * 3600;
        return {
            valid: true, // Still valid, but capped
            reason: ACTIVITY_MESSAGES.SESSION_CAPPED,
            cappedDurationSeconds: cappedSeconds,
            originalDurationSeconds: durationSeconds,
        };
    }

    return {
        valid: true,
        originalDurationSeconds: durationSeconds,
    };
}

/**
 * Validate daily total hours
 */
export function validateDailyTotal(
    currentTotal: number,
    additionalSeconds: number
): { valid: boolean; reason?: string; cappedSeconds?: number } {
    const newTotal = currentTotal + additionalSeconds;
    const maxDailySeconds = ACTIVITY_LIMITS.MAX_DAILY_HOURS * 3600;

    if (newTotal > maxDailySeconds) {
        const allowedAdditional = Math.max(0, maxDailySeconds - currentTotal);
        return {
            valid: false,
            reason: `Daily limit of ${ACTIVITY_LIMITS.MAX_DAILY_HOURS} hours reached`,
            cappedSeconds: allowedAdditional,
        };
    }

    return { valid: true };
}

/**
 * Check if activity timestamp is suspicious
 */
export function detectAnomalies(activity: {
    totalActiveSeconds: number;
    sessionCount?: number;
    date: Date;
}): { hasAnomaly: boolean; anomalies: string[] } {
    const anomalies: string[] = [];

    // Check for unrealistic total hours
    const totalHours = activity.totalActiveSeconds / 3600;
    if (totalHours > ACTIVITY_LIMITS.MAX_DAILY_HOURS) {
        anomalies.push(`Total hours (${totalHours.toFixed(1)}h) exceeds daily limit`);
    }

    // Check for suspicious session count
    if (activity.sessionCount && activity.sessionCount > 20) {
        anomalies.push(`Unusually high session count (${activity.sessionCount})`);
    }

    // Check for very short average sessions
    if (activity.sessionCount && activity.sessionCount > 0) {
        const avgSessionMinutes = (activity.totalActiveSeconds / activity.sessionCount) / 60;
        if (avgSessionMinutes < 5) {
            anomalies.push(`Very short average session (${avgSessionMinutes.toFixed(1)} min)`);
        }
    }

    return {
        hasAnomaly: anomalies.length > 0,
        anomalies,
    };
}
