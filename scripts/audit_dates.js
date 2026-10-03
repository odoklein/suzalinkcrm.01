const fs = require('fs');
const path = require('path');

const results = {
    newDate: [],
    dateMethods: [],
    prismaDates: [],
    dateParse: [],
    calendarTz: []
};

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        // Skip large compiled/third-party directories
        if (['node_modules', '.next', '.git', 'dist', 'build', '.gemini'].includes(file)) continue;

        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            continue;
        }

        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (/\.(ts|tsx|js|prisma)$/.test(file)) {
            let content;
            try {
                content = fs.readFileSync(fullPath, 'utf8');
            } catch (e) {
                continue;
            }
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                const lineNum = i + 1;
                if (file.endsWith('.prisma')) {
                    if (line.includes('DateTime') || line.includes(' Date')) {
                        results.prismaDates.push({ file: fullPath, line: lineNum, code: line.trim() });
                    }
                } else {
                    if (line.includes('new Date(')) {
                        results.newDate.push({ file: fullPath, line: lineNum, code: line.trim() });
                    }
                    if (/\.(toISOString|toLocaleDateString|toLocaleString|getUTCFullYear|getUTCMonth|getUTCDate|getFullYear|getMonth|getDate)\(/.test(line)) {
                        results.dateMethods.push({ file: fullPath, line: lineNum, code: line.trim() });
                    }
                    if (/Date\.parse|new Date\(['"]\d{4}-\d{2}-\d{2}/.test(line)) {
                        results.dateParse.push({ file: fullPath, line: lineNum, code: line.trim() });
                    }
                    if (line.includes('timeZone') || line.includes('FullCalendar')) {
                        results.calendarTz.push({ file: fullPath, line: lineNum, code: line.trim() });
                    }
                }
            });
        }
    }
}

walk('.');
fs.writeFileSync('DATE_AUDIT_RAW.json', JSON.stringify(results, null, 2));
console.log('Audit completed and saved to DATE_AUDIT_RAW.json (total matches: ' +
    (results.newDate.length + results.dateMethods.length + results.prismaDates.length) + ')');
