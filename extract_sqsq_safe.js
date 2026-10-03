const fs = require('fs');

const sq_content = fs.readFileSync('sqsq', 'utf-8');

const startMarker = '/* ── CLIENT GRID ';
let startIndex = sq_content.indexOf(startMarker);

const endMarker = '/* ─── SVG ICONS';
let endIndex = sq_content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find markers");
    process.exit(1);
}

const cards_css = sq_content.substring(startIndex, endIndex);

let globals = fs.readFileSync('app/globals.css', 'utf-8');

// remove previous broken append
const brokenAppendIdx = globals.indexOf("/* SQSQ PREMIUM CARD STYLES */");
if (brokenAppendIdx !== -1) {
    // go back a bit to remove the top comment
    const removeIdx = globals.lastIndexOf("/* ====", brokenAppendIdx);
    if (removeIdx !== -1) {
        globals = globals.substring(0, removeIdx);
    } else {
        globals = globals.substring(0, brokenAppendIdx);
    }
}

// now we also need root vars
const rootStart = sq_content.indexOf(':root {');
const rootEnd = sq_content.indexOf('}', rootStart) + 1;
const root_vars = sq_content.substring(rootStart, rootEnd);

const append_str = "\n\n/* ============================================ */\n" +
    "/* SQSQ PREMIUM CARD STYLES */\n" +
    "/* ============================================ */\n\n" +
    root_vars + "\n\n" + cards_css;

fs.writeFileSync('app/globals.css', globals + append_str, 'utf-8');
console.log("Successfully appended FULL sqsq CSS to app/globals.css, length=" + append_str.length);
