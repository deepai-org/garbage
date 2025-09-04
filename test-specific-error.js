const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Test specific template literal patterns
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Invalid backtick identifier" errors
const backtickErrors = parser.errors.filter(e => e.message === "Invalid backtick identifier");
console.log(`Found ${backtickErrors.length} backtick identifier errors`);

if (backtickErrors.length > 0) {
  // Show context around the first error
  const firstError = backtickErrors[0];
  const errorToken = firstError.token;
  console.log('\nFirst error token:', errorToken);
  
  // Find token index
  const tokenIndex = tokens.findIndex(t => t === errorToken);
  if (tokenIndex >= 0) {
    console.log('\nContext (5 tokens before and after):');
    for (let i = Math.max(0, tokenIndex - 5); i < Math.min(tokens.length, tokenIndex + 6); i++) {
      const marker = i === tokenIndex ? ' <-- ERROR' : '';
      console.log(`  [${i}] ${tokens[i].type}:${tokens[i].value}${marker}`);
    }
  }
}