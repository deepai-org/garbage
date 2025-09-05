const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Read the parser source and find the exact class structure
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = parserSource.split('\n');

console.log('=== Analyzing Parser class structure ===\n');

// Find the class definition and count braces to see where it should end
let classStart = -1;
let braceCount = 0;
let classEnd = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export class Parser')) {
    classStart = i;
    console.log(`Found class start at line ${i + 1}: ${line.trim()}`);
  }
  
  if (classStart >= 0) {
    // Count braces to find class end
    for (const char of line) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      
      // When brace count returns to 0, we've found the class end
      if (braceCount === 0 && i > classStart) {
        classEnd = i;
        break;
      }
    }
  }
  
  if (classEnd >= 0) break;
}

if (classStart >= 0 && classEnd >= 0) {
  console.log(`Class should end at line ${classEnd + 1}: ${lines[classEnd].trim()}`);
  console.log(`Class spans ${classEnd - classStart + 1} lines`);
  
  // Check if the parseSimpleType method is within this range
  for (let i = classStart; i <= classEnd; i++) {
    if (lines[i].includes('parseSimpleType():')) {
      console.log(`Found parseSimpleType at line ${i + 1} (within class: ${i >= classStart && i <= classEnd})`);
      console.log(`Line content: ${lines[i].trim()}`);
      break;
    }
  }
} else {
  console.log('Could not find complete class structure');
  console.log(`Class start: ${classStart}, Class end: ${classEnd}, Brace count: ${braceCount}`);
}

// Test if there are any unclosed braces or structural issues that might confuse the parser
console.log(`\nFinal brace count: ${braceCount} (should be 0 for balanced braces)`);

if (braceCount !== 0) {
  console.log(`⚠️  WARNING: Unbalanced braces detected! This could cause parsing issues.`);
}