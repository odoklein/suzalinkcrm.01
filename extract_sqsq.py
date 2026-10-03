import re

with open('sqsq', 'r', encoding='utf-8') as f:
    sq_content = f.read()

# match CSS from sqsq
css_match = re.search(r'const CSS=`(.*?)\n`;', sq_content, re.DOTALL)
if not css_match:
    print("Could not find CSS in sqsq")
    exit(1)

full_css = css_match.group(1)

# Extract root variables
root_match = re.search(r':root\s*\{([\s\S]*?)\}', full_css)
if root_match:
    root_vars = ":root {\n" + root_match.group(1) + "\n}"
else:
    root_vars = ""

# Extract client cards CSS
# Starts at /* ── CLIENT GRID ── */ and goes to the end or start of something else we want to keep
cards_match = re.search(r'(\/\* ── CLIENT GRID ─────────────────────────────────────── \*\/[\s\S]*?)(\/\* ─── SVG ICONS|\Z)', full_css, re.IGNORECASE)
if cards_match:
    cards_css = cards_match.group(1)
else:
    cards_css = ""

# Append to globals.css
with open('app/globals.css', 'a', encoding='utf-8') as f:
    f.write("\n\n/* ============================================ */\n")
    f.write("/* SQSQ PREMIUM CARD STYLES */\n")
    f.write("/* ============================================ */\n\n")
    f.write(root_vars + "\n\n" + cards_css)

print("Successfully appended sqsq CSS to app/globals.css")
