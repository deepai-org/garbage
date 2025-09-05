const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find colon errors in expressions
const colonErrors = parser.errors.filter(e => 
  e.message === "Unexpected token in expression" && e.token?.value === ':');

console.log(`Found ${colonErrors.length} colon expression errors\n`);

// Analyze patterns before colon
const patterns = {};
colonErrors.forEach(e => {
  const idx = tokens.indexOf(e.token);
  if (idx > 0) {
    const prev = tokens[idx - 1];
    const prevPrev = idx > 1 ? tokens[idx - 2] : null;
    const pattern = `${prevPrev?.value || ''} ${prev.value} :`;
    patterns[pattern] = (patterns[pattern] || 0) + 1;
  }
});

console.log('Patterns before colon errors:');
Object.entries(patterns)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([pattern, count]) => {
    console.log(`  ${count}x: ${pattern}`);
  });

// Check specific problematic cases
console.log('\n=== Checking object literal contexts ===\n');

colonErrors.slice(0, 3).forEach((e, i) => {
  const idx = tokens.indexOf(e.token);
  if (idx >= 0) {
    // Get line number
    let lineNum = 1;
    let charCount = 0;
    for (let l = 0; l < lines.length; l++) {
      if (charCount + lines[l].length >= e.token.start) {
        lineNum = l + 1;
        break;
      }
      charCount += lines[l].length + 1; // +1 for newline
    }
    
    console.log(`Error ${i + 1} at line ~${lineNum}:`);
    console.log(`  Code: "${lines[lineNum - 1]?.trim()}"`);
    
    // Check what comes after the colon
    if (idx < tokens.length - 1) {
      const next = tokens[idx + 1];
      console.log(`  After colon: ${next.type}:${next.value}`);
    }
    console.log();
  }
});