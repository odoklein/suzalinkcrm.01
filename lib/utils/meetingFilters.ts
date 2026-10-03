/**
 * RDV (meetings) list filter: exclude meetings cancelled with less than 10 minutes
 * before the scheduled time (callbackDate). Those are not shown in RDV lists.
 */
const CANCELLED_MIN_NOTICE_MS = 10 * 60 * 1000; // 10 minutes

export type ActionWithCancellationFields = {
    result: string;
    callbackDate: Date | null;
    confirmationUpdatedAt: Date | null;
};

/**
 * Returns true if this action should be EXCLUDED from RDV lists:
 * MEETING_CANCELLED and cancelled less than 10 min before the scheduled time.
 */
export function isExcludedCancelledLessThan10Min(
    action: ActionWithCancellationFields
): boolean {
    if (action.result !== "MEETING_CANCELLED") return false;
    const callback = action.callbackDate ? new Date(action.callbackDate) : null;
    const cancelledAt = action.confirmationUpdatedAt ? new Date(action.confirmationUpdatedAt) : null;
    if (!callback || !cancelledAt) return false;
    const noticeMs = callback.getTime() - cancelledAt.getTime();
    return noticeMs < CANCELLED_MIN_NOTICE_MS;
}

/**
 * Filter an array of actions to only those that should appear in RDV lists.
 */
export function filterRdvList<T extends ActionWithCancellationFields>(actions: T[]): T[] {
    return actions.filter((a) => !isExcludedCancelledLessThan10Min(a));
}
