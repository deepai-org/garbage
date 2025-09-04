const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Expected 'in' after case expression" errors
const caseErrors = parser.errors.filter(e => 
  e.message.includes("Expected 'in' after case")
);

console.log(`Found ${caseErrors.length} case errors:\n`);

// Show all of them
caseErrors.forEach(e => {
  const line = lines[e.token.line - 1] || '';
  console.log(`Line ${e.token.line}: ${line.trim()}`);
  console.log(`  Token: "${e.token.value}"`);
});