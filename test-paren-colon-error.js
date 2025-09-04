const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find where "Expected ')' but got ':'" errors occur
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find these specific errors
const parenColonErrors = parser.errors.filter(e => e.message === "Expected ')' but got ':'");
console.log(`Found ${parenColonErrors.length} "Expected ')' but got ':'" errors`);

if (parenColonErrors.length > 0) {
  // Show first few errors with context
  for (let i = 0; i < Math.min(3, parenColonErrors.length); i++) {
    const error = parenColonErrors[i];
    const errorToken = error.token;
    console.log(`\nError ${i + 1} at line ${errorToken.line}:`);
    
    // Find token index
    const tokenIndex = tokens.findIndex(t => t === errorToken);
    if (tokenIndex >= 0) {
      // Show surrounding tokens
      console.log('Context:');
      for (let j = Math.max(0, tokenIndex - 3); j < Math.min(tokens.length, tokenIndex + 3); j++) {
        const marker = j === tokenIndex ? ' <-- ERROR HERE' : '';
        console.log(`  ${tokens[j].type}:${tokens[j].value}${marker}`);
      }
    }
  }
}