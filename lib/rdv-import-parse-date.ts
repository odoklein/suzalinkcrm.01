/**
 * Parse RDV dates from CSV/Excel exports (ISO, French DD/MM/YYYY, Excel serial).
 */

function parseExcelSerialDate(raw: string): Date | undefined {
    const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
    const serial = parseFloat(normalized);
    // Ignore small integers (years, counts); Excel day counts for 1982+ are ~30000+
    if (serial < 30000 || serial > 1_000_000) return undefined;
    const whole = Math.floor(serial);
    const frac = serial - whole;
    // Days from 1899-12-30 to Unix epoch (common Excel → JS conversion)
    const ms = (whole - 25569) * 86_400_000 + Math.round(frac * 86_400_000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

export function parseRdvImportDate(raw: string): Date | undefined {
    const value = raw.trim();
    if (!value) return undefined;

    const excel = parseExcelSerialDate(value);
    if (excel) return excel;

    // ISO yyyy-mm-dd or yyyy-mm-ddTHH:mm (interpret calendar parts in local time)
    const isoMatch = value.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        const hours = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
        const minutes = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
        if (
            !Number.isNaN(year) &&
            !Number.isNaN(month) &&
            !Number.isNaN(day) &&
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31
        ) {
            const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
            if (!Number.isNaN(d.getTime())) return d;
        }
    }

    // French: DD/MM/YYYY, separators / - . ; optional time HH:MM or HH:MM:SS
    const frMatch = value.match(
        /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (frMatch) {
        const day = parseInt(frMatch[1], 10);
        const month = parseInt(frMatch[2], 10);
        let year = parseInt(frMatch[3], 10);
        const hours = frMatch[4] ? parseInt(frMatch[4], 10) : 0;
        const minutes = frMatch[5] ? parseInt(frMatch[5], 10) : 0;
        const seconds = frMatch[6] ? parseInt(frMatch[6], 10) : 0;
        if (year < 100) year = 2000 + year;
        if (
            Number.isNaN(day) ||
            Number.isNaN(month) ||
            Number.isNaN(year) ||
            day < 1 ||
            day > 31 ||
            month < 1 ||
            month > 12
        ) {
            return undefined;
        }
        const d = new Date(year, month - 1, day, hours, minutes, seconds, 0);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }

    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
}
