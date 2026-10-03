export function overlaps(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string
): boolean {
    return aStart < bEnd && aEnd > bStart;
}

export interface BlockForConflict {
    id: string;
    sdrId: string;
    date: string | Date;
    startTime: string;
    endTime: string;
    suggestionStatus?: string | null;
    missionId?: string;
    mission?: { name?: string };
}

export interface ConflictInfo {
    missionName?: string;
    otherBlockId?: string;
}

/**
 * Returns a map of blockId -> conflict info for blocks that overlap with another
 * SUGGESTED block for the same SDR on the same day.
 */
export function detectConflicts(blocks: BlockForConflict[]): Record<string, ConflictInfo> {
    const result: Record<string, ConflictInfo> = {};
    const suggested = blocks.filter((b) => b.suggestionStatus === "SUGGESTED");

    for (let i = 0; i < suggested.length; i++) {
        const a = suggested[i];
        const dateStr =
            typeof a.date === "string" ? a.date.slice(0, 10) : new Date(a.date).toISOString().slice(0, 10);

        for (let j = i + 1; j < suggested.length; j++) {
            const b = suggested[j];
            if (a.sdrId !== b.sdrId) continue;
            const bDateStr =
                typeof b.date === "string" ? b.date.slice(0, 10) : new Date(b.date).toISOString().slice(0, 10);
            if (dateStr !== bDateStr) continue;
            if (!overlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

            result[a.id] = {
                missionName: b.mission?.name,
                otherBlockId: b.id,
            };
            result[b.id] = {
                missionName: a.mission?.name,
                otherBlockId: a.id,
            };
        }
    }

    return result;
}
