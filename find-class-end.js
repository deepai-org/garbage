const fs = require('fs');
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

let braceCount = 0;
let classStartLine = -1;
let classEndLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export class Parser')) {
    classStartLine = i + 1;
    console.log(`Parser class starts at line ${classStartLine}`);
  }
  
  if (classStartLine > 0) {
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          classEndLine = i + 1;
          console.log(`Parser class should end at line ${classEndLine}`);
          console.log(`Line content: ${line.trim()}`);
          break;
        }
      }
    }
    if (classEndLine > 0) break;
  }
}

if (classEndLine === -1) {
  console.log('No matching closing brace found for Parser class!');
  console.log(`Final brace count: ${braceCount}`);
}