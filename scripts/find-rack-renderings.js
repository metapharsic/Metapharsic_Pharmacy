const fs = require('fs');
const path = require('path');

function searchDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        searchDir(full, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(full);
    }
  }
  return fileList;
}

const files = searchDir('src');
const matches = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check if line contains JSX child with rack: e.g. {rack}, {p.rack}, {row.original.rack}, {item.rack}, etc.
    if (/\{[^{}]*(?:rack|shelf)[^{}]*\}/.test(line) && !/className|\btype\b|\bon[A-Z]|\bkey=/.test(line)) {
      matches.push({ file: f, line: idx + 1, text: line.trim() });
    }
  });
}

console.log(`Found ${matches.length} possible JSX renderings of rack/shelf:`);
matches.forEach(m => console.log(`${m.file}:${m.line}  ->  ${m.text}`));

