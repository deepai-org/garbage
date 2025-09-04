const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find template literals in parser.ts
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lines = code.split('\n');

// Look for template literals with problematic patterns
lines.forEach((line, i) => {
  if (line.includes('`') && line.includes('${')) {
    console.log(`Line ${i + 1}: ${line.trim().substring(0, 100)}`);
  }
});