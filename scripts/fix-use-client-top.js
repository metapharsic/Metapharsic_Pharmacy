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

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  if (code.includes("'use client'") || code.includes('"use client"')) {
    const lines = code.split('\n');
    const useClientIdx = lines.findIndex(l => l.trim() === "'use client'" || l.trim() === '"use client"');
    if (useClientIdx > 0) {
      // Move 'use client' to line 0
      const directive = lines[useClientIdx].trim();
      lines.splice(useClientIdx, 1);
      lines.unshift(directive, '');
      fs.writeFileSync(file, lines.join('\n'), 'utf8');
      console.log(`Moved 'use client' to top in ${file}`);
    }
  }
}

