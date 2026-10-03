const fs = require('fs');

const sq_content = fs.readFileSync('sqsq', 'utf-8');

const css_match = sq_content.match(/const CSS=`([\s\S]*?)`;/);
if (!css_match) {
    console.error("Could not find CSS in sqsq");
    process.exit(1);
}

const full_css = css_match[1];

let root_vars = "";
const root_match = full_css.match(/:root\s*\{([\s\S]*?)\}/);
if (root_match) {
    root_vars = ":root {\n" + root_match[1] + "\n}";
}

let cards_css = "";
const cards_match = full_css.match(/(\/\* ── CLIENT GRID ─────────────────────────────────────── \*\/[\s\S]*?)(\/\* ─── SVG ICONS|\Z)/i);
if (cards_match) {
    cards_css = cards_match[1];
}

const append_str = "\n\n/* ============================================ */\n" +
    "/* SQSQ PREMIUM CARD STYLES */\n" +
    "/* ============================================ */\n\n" +
    root_vars + "\n\n" + cards_css;

fs.appendFileSync('app/globals.css', append_str, 'utf-8');
console.log("Successfully appended sqsq CSS to app/globals.css");
