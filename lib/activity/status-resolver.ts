// ============================================
// STATUS RESOLVER
// Centralized status determination logic
// ============================================

import { ACTIVITY_LIMITS } from './constants';

export type ActivityStatus = 'active' | 'idle' | 'away' | 'offline';
export type DisplayStatus = 'online' | 'busy' | 'away' | 'offline';

export interface ActivityStatusResult {
    status: ActivityStatus;
    displayStatus: DisplayStatus;
    lastSeenMinutesAgo: number | null;
    isActive: boolean;
}

export interface CrmActivityDay {
    id: string;
    userId: string;
    date: Date;
    totalActiveSeconds: number;
    currentSessionStartedAt: Date | null;
    lastActivityAt: Date | null;
}

export interface ScheduleBlock {
    id: string;
    status: string;
    missionId: string;
    mission?: { name: string };
}

/**
 * Resolve activity status based on last activity timestamp
 * 
 * Status hierarchy:
 * - active: < 1 minute ago
 * - idle: 1-5 minutes ago
 * - away: 5-30 minutes ago
 * - offline: > 30 minutes ago or no activity
 */
export function resolveActivityStatus(
    activity: CrmActivityDay | null,
    scheduleBlock?: ScheduleBlock | null,
    now: Date = new Date()
): ActivityStatusResult {
    // No activity record or no last activity
    if (!activity?.lastActivityAt) {
        return {
            status: 'offline',
            displayStatus: 'offline',
            lastSeenMinutesAgo: null,
            isActive: false,
        };
    }

    // Calculate minutes since last activity
    const minutesAgo = Math.floor(
        (now.getTime() - activity.lastActivityAt.getTime()) / 60000
    );

    // Determine base status
    let status: ActivityStatus;
    if (minutesAgo < ACTIVITY_LIMITS.ACTIVE_THRESHOLD_MINUTES) {
        status = 'active';
    } else if (minutesAgo < ACTIVITY_LIMITS.IDLE_THRESHOLD_MINUTES) {
        status = 'idle';
    } else if (minutesAgo < ACTIVITY_LIMITS.AWAY_THRESHOLD_MINUTES) {
        status = 'away';
    } else {
        status = 'offline';
    }

    // Map to display status
    let displayStatus: DisplayStatus;
    const hasActiveSession = activity.currentSessionStartedAt !== null;

    if (status === 'active' || status === 'idle') {
        // User is actively working
        if (scheduleBlock?.status === 'IN_PROGRESS') {
            displayStatus = 'busy'; // Working on scheduled mission
        } else {
            displayStatus = 'online'; // Active but not on scheduled block
        }
    } else if (status === 'away') {
        displayStatus = 'away';
    } else {
        displayStatus = 'offline';
    }

    return {
        status,
        displayStatus,
        lastSeenMinutesAgo: minutesAgo,
        isActive: hasActiveSession && (status === 'active' || status === 'idle'),
    };
}

/**
 * Check if activity should be auto-paused
 */
export function shouldAutoPause(
    activity: CrmActivityDay | null,
    now: Date = new Date()
): boolean {
    if (!activity?.currentSessionStartedAt || !activity.lastActivityAt) {
        return false;
    }

    const timeSinceLastActivity = now.getTime() - activity.lastActivityAt.getTime();
    return timeSinceLastActivity >= ACTIVITY_LIMITS.INACTIVITY_THRESHOLD_MS;
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: DisplayStatus): string {
    const labels: Record<DisplayStatus, string> = {
        online: 'En ligne',
        busy: 'Occupé',
        away: 'Absent',
        offline: 'Hors ligne',
    };
    return labels[status];
}

/**
 * Get status color configuration
 */
export function getStatusConfig(status: DisplayStatus): {
    color: string;
    label: string;
    pulse: boolean;
} {
    const configs = {
        online: { color: 'bg-emerald-500', label: 'En ligne', pulse: true },
        busy: { color: 'bg-amber-500', label: 'Occupé', pulse: true },
        away: { color: 'bg-slate-400', label: 'Absent', pulse: false },
        offline: { color: 'bg-slate-300', label: 'Hors ligne', pulse: false },
    };
    return configs[status];
}
