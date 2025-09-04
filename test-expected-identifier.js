const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find "Expected identifier" errors
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const identifierErrors = parser.errors.filter(e => e.message === "Expected identifier");
console.log(`Found ${identifierErrors.length} "Expected identifier" errors`);

// Show first few errors with context
for (let i = 0; i < Math.min(5, identifierErrors.length); i++) {
  const error = identifierErrors[i];
  const errorToken = error.token;
  console.log(`\nError ${i + 1} at line ${errorToken.line}:`);
  console.log(`  Token: ${errorToken.type}:${errorToken.value}`);
  
  // Find token index
  const tokenIndex = tokens.findIndex(t => t === errorToken);
  if (tokenIndex >= 0) {
    console.log('  Context:');
    for (let j = Math.max(0, tokenIndex - 2); j < Math.min(tokens.length, tokenIndex + 3); j++) {
      const marker = j === tokenIndex ? ' <-- ERROR' : '';
      console.log(`    ${tokens[j].type}:${tokens[j].value}${marker}`);
    }
  }
}