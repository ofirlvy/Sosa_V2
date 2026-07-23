import fs from 'fs';

const logFile = '/.gemini/antigravity/brain/1b29503c-3896-4133-82e9-3e79f6571951/.system_generated/logs/overview.txt';
const content = fs.readFileSync(logFile, 'utf-8');

const svgStart = content.lastIndexOf('<svg');
const svgEnd = content.lastIndexOf('</svg>') + 6;

if (svgStart !== -1 && svgEnd !== -1) {
  const svgContent = content.substring(svgStart, svgEnd);
  fs.writeFileSync('public/footer-pattern.svg', `<?xml version="1.0" encoding="UTF-8"?>\n${svgContent}`);
  console.log('Successfully extracted SVG');
} else {
  console.log('SVG not found');
}
