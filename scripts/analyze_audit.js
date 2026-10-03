const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('DATE_AUDIT_RAW.json'));

let md = '# Date Audit Report\n\n';

md += '## 1. Summary of Usages\n';
md += `- **Prisma Schema Date fields**: ${data.prismaDates.length}\n`;
md += `- **new Date() instantiations**: ${data.newDate.length}\n`;
md += `- **Date formatting/methods** (.toISOString, etc): ${data.dateMethods.length}\n`;
md += `- **String Parsing (Date.parse / new Date("YYYY-MM-DD"))**: ${data.dateParse.length}\n`;
md += `- **Calendar / Timezone references**: ${data.calendarTz.length}\n\n`;

const filesWithDates = new Set();
data.newDate.forEach(item => filesWithDates.add(item.file));
data.dateMethods.forEach(item => filesWithDates.add(item.file));

md += `Total files containing Date logic: ${filesWithDates.size}\n\n`;

md += '## 2. API Routes handling Dates\n';
const apiFiles = Array.from(filesWithDates).filter(f => f.includes('/api/') || f.includes('\\api\\'));
Array.from(new Set(apiFiles)).forEach(f => md += `- \`${f}\`\n`);

md += '\n## 3. Database Schema Date Fields\n';
data.prismaDates.forEach(item => {
    md += `- \`${item.file}:${item.line}\` - \`${item.code}\`\n`;
});

md += '\n## 4. Problematic Date Parsing (Explicit YYYY-MM-DD)\n';
data.dateParse.forEach(item => {
    md += `- \`${item.file}:${item.line}\` - \`${item.code}\`\n`;
});

md += '\n## 5. Calendar & Timezone Configs\n';
data.calendarTz.forEach(item => {
    md += `- \`${item.file}:${item.line}\` - \`${item.code}\`\n`;
});

// Check where new Date(YYYY-MM-DD) is specifically used
const problematicDates = data.newDate.filter(item => /new Date\(['"`][0-9]{4}-[0-9]{2}-[0-9]{2}['"`]\)/.test(item.code));
if (problematicDates.length > 0) {
    md += '\n## 6. Hardcoded YYYY-MM-DD Instantiations (Hydration / Timezone Risk)\n';
    problematicDates.forEach(item => {
        md += `- \`${item.file}:${item.line}\` - \`${item.code}\`\n`;
    });
}

fs.writeFileSync('C:/Users/mamin/.gemini/antigravity/brain/bc4235f6-979e-4372-92e7-890389cf74da/DATE_REPORT.md', md);
console.log('Report generated.');
