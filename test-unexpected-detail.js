const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find specific patterns of unexpected token errors
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const unexpectedErrors = parser.errors.filter(e => e.message === "Unexpected token in expression");

// Look for 'else' keyword errors specifically
const elseErrors = unexpectedErrors.filter(e => e.token.value === "else");
console.log(`Found ${elseErrors.length} 'else' errors`);

if (elseErrors.length > 0) {
  const error = elseErrors[0];
  console.log(`\nFirst 'else' error at line ${error.token.line}:`);
  const tokenIndex = tokens.findIndex(t => t === error.token);
  if (tokenIndex >= 0) {
    console.log('Context (10 tokens before):');
    for (let j = Math.max(0, tokenIndex - 10); j < tokenIndex + 3; j++) {
      const marker = j === tokenIndex ? ' <-- ERROR' : '';
      const t = tokens[j];
      if (t.type !== 'VirtualSemi') {
        console.log(`  ${t.type}:${t.value}${marker}`);
      }
    }
  }
}

// Look for 'do' keyword errors
const doErrors = unexpectedErrors.filter(e => e.token.value === "do");
console.log(`\nFound ${doErrors.length} 'do' errors`);

if (doErrors.length > 0) {
  const error = doErrors[0];
  console.log(`\nFirst 'do' error at line ${error.token.line}:`);
  const tokenIndex = tokens.findIndex(t => t === error.token);
  if (tokenIndex >= 0) {
    console.log('Context:');
    for (let j = Math.max(0, tokenIndex - 5); j < tokenIndex + 3; j++) {
      const marker = j === tokenIndex ? ' <-- ERROR' : '';
      const t = tokens[j];
      console.log(`  ${t.type}:${t.value}${marker}`);
    }
  }
}