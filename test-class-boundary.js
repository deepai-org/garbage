const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find the parseListComprehension method
const lineNum = 4829 - 1; // 0-indexed
console.log('Line 4829:', lines[lineNum]);

// Get surrounding context
console.log('\nContext (lines 4820-4835):');
for (let i = 4819; i < 4835 && i < lines.length; i++) {
  console.log(`  ${i + 1}: ${lines[i]}`);
}

// Check if we're inside the Parser class
let insideClass = false;
let braceDepth = 0;
for (let i = 0; i < lineNum; i++) {
  const line = lines[i];
  if (line.includes('export class Parser')) {
    insideClass = true;
    console.log('\nFound Parser class at line', i + 1);
  }
  
  // Count braces to track nesting
  for (let char of line) {
    if (char === '{') braceDepth++;
    else if (char === '}') braceDepth--;
  }
}

console.log('\nAt line 4829:');
console.log('  Inside Parser class:', insideClass);
console.log('  Brace depth:', braceDepth);