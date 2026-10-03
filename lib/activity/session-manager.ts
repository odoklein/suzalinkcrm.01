// ============================================
// SESSION MANAGER
// Transaction-safe session operations
// ============================================

import { prisma } from '@/lib/prisma';
import { validateSession, validateDailyTotal } from './validators';
import { ACTIVITY_LIMITS } from './constants';

export interface PauseSessionOptions {
    maxSessionHours?: number;
    skipValidation?: boolean;
}

export interface PauseSessionResult {
    success: boolean;
    totalActiveSeconds: number;
    sessionSeconds: number;
    wasCapped: boolean;
    error?: string;
}

/**
 * Pause an active session with transaction safety and validation
 * This is the ONLY way sessions should be paused to prevent race conditions
 */
export async function pauseSession(
    userId: string,
    options: PauseSessionOptions = {}
): Promise<PauseSessionResult> {
    const maxSessionHours = options.maxSessionHours ?? ACTIVITY_LIMITS.MAX_SESSION_HOURS;

    try {
        return await prisma.$transaction(async (tx) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get current activity with lock
            const activity = await tx.crmActivityDay.findUnique({
                where: {
                    userId_date: {
                        userId,
                        date: today,
                    },
                },
            });

            // No active session to pause
            if (!activity?.currentSessionStartedAt) {
                return {
                    success: true,
                    totalActiveSeconds: activity?.totalActiveSeconds || 0,
                    sessionSeconds: 0,
                    wasCapped: false,
                };
            }

            const now = new Date();

            // Validate session duration
            const validation = validateSession(activity.currentSessionStartedAt, now);

            if (!validation.valid && !options.skipValidation) {
                return {
                    success: false,
                    totalActiveSeconds: activity.totalActiveSeconds,
                    sessionSeconds: 0,
                    wasCapped: false,
                    error: validation.reason,
                };
            }

            // Use capped duration if session exceeded max
            let sessionSeconds = validation.originalDurationSeconds || 0;
            let wasCapped = false;

            if (validation.cappedDurationSeconds) {
                sessionSeconds = validation.cappedDurationSeconds;
                wasCapped = true;
                console.warn(
                    `[Session Manager] Session capped for user ${userId}: ` +
                    `${validation.originalDurationSeconds}s -> ${sessionSeconds}s`
                );
            }

            // Validate daily total
            const dailyValidation = validateDailyTotal(
                activity.totalActiveSeconds,
                sessionSeconds
            );

            if (!dailyValidation.valid && dailyValidation.cappedSeconds !== undefined) {
                sessionSeconds = dailyValidation.cappedSeconds;
                wasCapped = true;
                console.warn(
                    `[Session Manager] Daily limit reached for user ${userId}: ` +
                    `capping at ${sessionSeconds}s`
                );
            }

            // Update with atomic increment
            const updated = await tx.crmActivityDay.update({
                where: {
                    id: activity.id,
                    // Optimistic lock: ensure record hasn't been modified
                    updatedAt: activity.updatedAt,
                },
                data: {
                    totalActiveSeconds: {
                        increment: sessionSeconds,
                    },
                    currentSessionStartedAt: null,
                    sessionCount: {
                        increment: 1,
                    },
                    // Update longest session if this one is longer
                    longestSessionSeconds: Math.max(
                        activity.longestSessionSeconds || 0,
                        sessionSeconds
                    ),
                },
            });

            return {
                success: true,
                totalActiveSeconds: updated.totalActiveSeconds,
                sessionSeconds,
                wasCapped,
            };
        });
    } catch (error) {
        console.error('[Session Manager] Error pausing session:', error);

        // Handle optimistic lock failure
        if (error instanceof Error && error.message.includes('Record to update not found')) {
            // Retry once
            return pauseSession(userId, options);
        }

        return {
            success: false,
            totalActiveSeconds: 0,
            sessionSeconds: 0,
            wasCapped: false,
            error: 'Failed to pause session',
        };
    }
}

/**
 * Start a new session
 */
export async function startSession(userId: string): Promise<{
    success: boolean;
    currentSessionStartedAt: Date | null;
    totalActiveSeconds: number;
}> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    try {
        // Get or create activity record
        const activity = await prisma.crmActivityDay.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
            create: {
                userId,
                date: today,
                totalActiveSeconds: 0,
                currentSessionStartedAt: now,
                lastActivityAt: now,
                sessionCount: 0,
                longestSessionSeconds: 0,
            },
            update: {
                currentSessionStartedAt: now,
                lastActivityAt: now,
            },
        });

        return {
            success: true,
            currentSessionStartedAt: activity.currentSessionStartedAt,
            totalActiveSeconds: activity.totalActiveSeconds,
        };
    } catch (error) {
        console.error('[Session Manager] Error starting session:', error);
        return {
            success: false,
            currentSessionStartedAt: null,
            totalActiveSeconds: 0,
        };
    }
}

/**
 * Update last activity timestamp (heartbeat).
 * Also updates User.lastConnectedAt for team performance tracking.
 */
export async function updateLastActivity(userId: string): Promise<{
    success: boolean;
    lastActivityAt: Date | null;
}> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    try {
        const [activity, _] = await prisma.$transaction([
            prisma.crmActivityDay.upsert({
                where: {
                    userId_date: {
                        userId,
                        date: today,
                    },
                },
                create: {
                    userId,
                    date: today,
                    totalActiveSeconds: 0,
                    currentSessionStartedAt: now,
                    lastActivityAt: now,
                    sessionCount: 0,
                    longestSessionSeconds: 0,
                },
                update: {
                    lastActivityAt: now,
                },
            }),
            prisma.user.update({
                where: { id: userId },
                data: { lastConnectedAt: now },
            }),
        ]);

        return {
            success: true,
            lastActivityAt: activity.lastActivityAt,
        };
    } catch (error) {
        console.error('[Session Manager] Error updating last activity:', error);
        return {
            success: false,
            lastActivityAt: null,
        };
    }
}
