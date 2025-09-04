const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find "Unexpected token in expression" errors
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const unexpectedErrors = parser.errors.filter(e => e.message === "Unexpected token in expression");
console.log(`Found ${unexpectedErrors.length} "Unexpected token in expression" errors`);

// Group errors by token value to find patterns
const errorPatterns = {};
for (const error of unexpectedErrors) {
  const key = `${error.token.type}:${error.token.value}`;
  errorPatterns[key] = (errorPatterns[key] || 0) + 1;
}

console.log('\nError patterns (top 10):');
const sorted = Object.entries(errorPatterns).sort((a, b) => b[1] - a[1]);
for (let i = 0; i < Math.min(10, sorted.length); i++) {
  console.log(`  ${sorted[i][1]}x: ${sorted[i][0]}`);
}

// Show context for a few different patterns
console.log('\nSample errors:');
const samples = {};
for (const error of unexpectedErrors) {
  const key = `${error.token.type}:${error.token.value}`;
  if (!samples[key] && Object.keys(samples).length < 5) {
    samples[key] = error;
  }
}

for (const [key, error] of Object.entries(samples)) {
  const errorToken = error.token;
  console.log(`\n${key} at line ${errorToken.line}:`);
  const tokenIndex = tokens.findIndex(t => t === errorToken);
  if (tokenIndex >= 0) {
    for (let j = Math.max(0, tokenIndex - 3); j < Math.min(tokens.length, tokenIndex + 2); j++) {
      const marker = j === tokenIndex ? ' <-- ERROR' : '';
      console.log(`  ${tokens[j].type}:${tokens[j].value}${marker}`);
    }
  }
}