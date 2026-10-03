/**
 * Parse callback date from SDR note
 * Supports formats:
 * - "Rappeler le 30/01/2026"
 * - "Rappel 30-01-2026"
 * - "30/01/2026"
 * - "30.01.2026"
 * - "2026-01-30"
 * - "Rappeler lundi" (future: days of week)
 * - "Rappeler demain"
 */

export function parseDateFromNote(note: string | null | undefined): Date | null {
    if (!note || !note.trim()) {
        return null;
    }

    const noteText = note.toLowerCase().trim();

    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const ddmmyyyyRegex = /(\d{1,2})[\/.\\-](\d{1,2})[\/.\\-](\d{4})/;
    const ddmmyyyyMatch = noteText.match(ddmmyyyyRegex);
    if (ddmmyyyyMatch) {
        const day = parseInt(ddmmyyyyMatch[1], 10);
        const month = parseInt(ddmmyyyyMatch[2], 10);
        const year = parseInt(ddmmyyyyMatch[3], 10);

        // Validate date
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            // Only return if date is in the future
            if (date > new Date()) {
                return date;
            }
        }
    }

    // Pattern 2: YYYY-MM-DD (ISO format)
    const yyyymmddRegex = /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/;
    const yyyymmddMatch = noteText.match(yyyymmddRegex);
    if (yyyymmddMatch) {
        const year = parseInt(yyyymmddMatch[1], 10);
        const month = parseInt(yyyymmddMatch[2], 10);
        const day = parseInt(yyyymmddMatch[3], 10);

        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const date = new Date(year, month - 1, day);
            if (date > new Date()) {
                return date;
            }
        }
    }

    // Pattern 3: "demain" / "tomorrow"
    if (noteText.includes('demain') || noteText.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Set to 9 AM
        return tomorrow;
    }

    // Pattern 4: "dans X jours" / "in X days"
    const daysRegex = /dans (\d+) jours?|in (\d+) days?/;
    const daysMatch = noteText.match(daysRegex);
    if (daysMatch) {
        const days = parseInt(daysMatch[1] || daysMatch[2], 10);
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        futureDate.setHours(9, 0, 0, 0);
        return futureDate;
    }

    // Pattern 5: Days of week (lundi, mardi, etc.) - find next occurrence
    const daysOfWeek: { [key: string]: number } = {
        'lundi': 1,
        'mardi': 2,
        'mercredi': 3,
        'jeudi': 4,
        'vendredi': 5,
        'samedi': 6,
        'dimanche': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6,
        'sunday': 0,
    };

    for (const [dayName, dayNum] of Object.entries(daysOfWeek)) {
        if (noteText.includes(dayName)) {
            const today = new Date();
            const currentDay = today.getDay();
            let daysUntil = dayNum - currentDay;

            if (daysUntil <= 0) {
                daysUntil += 7; // Next week
            }

            const futureDate = new Date();
            futureDate.setDate(today.getDate() + daysUntil);
            futureDate.setHours(9, 0, 0, 0);
            return futureDate;
        }
    }

    return null;
}

/**
 * Format callback date for display (date only)
 */
export function formatCallbackDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const callbackDay = new Date(d);
    callbackDay.setHours(0, 0, 0, 0);

    if (callbackDay.getTime() === today.getTime()) {
        return "Aujourd'hui";
    } else if (callbackDay.getTime() === tomorrow.getTime()) {
        return "Demain";
    } else {
        return d.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    }
}

/**
 * Format callback date and time for display.
 * callbackDate is stored in UTC; this converts to user's local timezone.
 */
export function formatCallbackDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
        hour12: false,
    });
}
