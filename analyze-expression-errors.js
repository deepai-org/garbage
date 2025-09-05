const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Unexpected token in expression" errors
const exprErrors = parser.errors.filter(e => 
  e.message === "Unexpected token in expression");

console.log(`Found ${exprErrors.length} "Unexpected token in expression" errors\n`);

// Group by token value
const tokenGroups = {};
exprErrors.forEach(e => {
  const key = `${e.token?.type}:${e.token?.value}`;
  tokenGroups[key] = (tokenGroups[key] || 0) + 1;
});

console.log('Token patterns causing expression errors:');
Object.entries(tokenGroups)
  .sort((a, b) => b[1] - a[1])
  .forEach(([token, count]) => {
    console.log(`  ${count}x: ${token}`);
  });

// Show some specific examples
console.log('\n=== First 5 error contexts ===\n');
exprErrors.slice(0, 5).forEach((e, i) => {
  const errorToken = e.token;
  const idx = tokens.indexOf(errorToken);
  
  if (idx >= 0) {
    console.log(`Error ${i + 1} at token ${idx}:`);
    
    // Show wider context
    for (let j = Math.max(0, idx - 5); j <= Math.min(tokens.length - 1, idx + 3); j++) {
      const t = tokens[j];
      if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
        const marker = j === idx ? ' <-- ERROR' : '';
        console.log(`  [${j}] ${t.type}:${t.value}${marker}`);
      }
    }
    console.log();
  }
});