const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find case-related errors
const caseErrors = parser.errors.filter(e => 
  e.message.includes('case') || (e.token && e.token.value === 'case'));

console.log(`Found ${caseErrors.length} case-related errors\n`);

// Show unique error messages
const uniqueMessages = new Set();
caseErrors.forEach(e => uniqueMessages.add(e.message));

console.log('Unique error messages:');
uniqueMessages.forEach(msg => {
  const count = caseErrors.filter(e => e.message === msg).length;
  console.log(`  ${count}x: ${msg}`);
});

// Find specific case token errors
const unexpectedCases = parser.errors.filter(e => 
  e.message === "Unexpected token in expression" && e.token?.value === 'case');

console.log(`\n${unexpectedCases.length} "Unexpected token in expression" for 'case'\n`);

// Show context for first few case errors
console.log('Sample case error contexts:');
unexpectedCases.slice(0, 5).forEach((e, i) => {
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
      charCount += lines[l].length + 1;
    }
    
    console.log(`\nError ${i + 1} at line ~${lineNum}:`);
    console.log(`  Code: "${lines[lineNum - 1]?.trim()}"`);
    
    // Show token context
    console.log('  Tokens:');
    for (let j = Math.max(0, idx - 3); j <= Math.min(tokens.length - 1, idx + 2); j++) {
      if (tokens[j].type !== 'VirtualSemi' && tokens[j].type !== 'EOF') {
        const marker = j === idx ? ' <-- CASE ERROR' : '';
        console.log(`    [${j}] ${tokens[j].type}:${tokens[j].value}${marker}`);
      }
    }
  }
});