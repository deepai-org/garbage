const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Test parsing parser.ts with type assertions
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log(`Total tokens: ${tokens.length}`);

const parser = new Parser(tokens);
const ast = parser.parse();

// Count specific error types
const errorCounts = {};
for (const error of parser.errors) {
  const msg = error.message;
  if (!errorCounts[msg]) errorCounts[msg] = 0;
  errorCounts[msg]++;
}

console.log('\nError summary:');
const sortedErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]);
for (const [msg, count] of sortedErrors.slice(0, 10)) {
  console.log(`  ${count}x: ${msg}`);
}

console.log(`\nTotal AST nodes: ${ast.body.length}`);
console.log(`Total parse errors: ${parser.errors.length}`);