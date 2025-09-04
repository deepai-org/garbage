const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find "Expected '}' after object properties" errors
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const braceErrors = parser.errors.filter(e => e.message === "Expected '}' after object properties");
console.log(`Found ${braceErrors.length} "Expected '}' after object properties" errors`);

// Show first few errors with context
for (let i = 0; i < Math.min(3, braceErrors.length); i++) {
  const error = braceErrors[i];
  const errorToken = error.token;
  console.log(`\nError ${i + 1} at line ${errorToken.line}:`);
  console.log(`  Token: ${errorToken.type}:${errorToken.value}`);
  
  // Find token index and show context
  const tokenIndex = tokens.findIndex(t => t === errorToken);
  if (tokenIndex >= 0) {
    console.log('  Context (5 tokens before):');
    for (let j = Math.max(0, tokenIndex - 5); j < tokenIndex + 1; j++) {
      const marker = j === tokenIndex ? ' <-- ERROR' : '';
      console.log(`    ${tokens[j].type}:${tokens[j].value}${marker}`);
    }
  }
}