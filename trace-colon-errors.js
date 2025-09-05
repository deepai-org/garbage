const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// First, just lex and find all colons
console.log('=== Finding all colon tokens ===\n');

const colonTokens = [];
tokens.forEach((t, i) => {
  if (t.value === ':' && t.type === 'Operator') {
    colonTokens.push({
      index: i,
      prev: tokens[i-1]?.value,
      next: tokens[i+1]?.value
    });
  }
});

console.log(`Found ${colonTokens.length} colon tokens\n`);

// Now parse and see which ones cause errors
const parser = new Parser(tokens);
const ast = parser.parse();

const colonErrors = parser.errors.filter(e => 
  e.message.includes('Unexpected token') && e.token?.value === ':');

console.log(`${colonErrors.length} colons caused "Unexpected token" errors\n`);

// Find which colons are problematic
const errorTokenIndices = new Set();
colonErrors.forEach(e => {
  const idx = tokens.indexOf(e.token);
  if (idx >= 0) {
    errorTokenIndices.add(idx);
  }
});

// Analyze patterns
const errorPatterns = {};
colonTokens.forEach(ct => {
  if (errorTokenIndices.has(ct.index)) {
    const pattern = `${ct.prev} : ${ct.next}`;
    errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
  }
});

console.log('=== Error patterns (prev : next) ===\n');
Object.entries(errorPatterns)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([pattern, count]) => {
    console.log(`  ${count}x: ${pattern}`);
  });

// Find specific problem areas
console.log('\n=== Sample error contexts ===\n');

let shown = 0;
colonErrors.forEach(e => {
  if (shown >= 5) return;
  
  const idx = tokens.indexOf(e.token);
  if (idx >= 0) {
    console.log(`Error at token ${idx}:`);
    
    // Show wider context
    for (let i = Math.max(0, idx - 5); i <= Math.min(tokens.length - 1, idx + 5); i++) {
      const t = tokens[i];
      if (t.type !== 'VirtualSemi' && t.type !== 'EOF' && t.type !== 'Comment') {
        const marker = i === idx ? ' <-- ERROR' : '';
        console.log(`  [${i}] ${t.type}:${t.value}${marker}`);
      }
    }
    console.log();
    shown++;
  }
});