const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('=== Final 3 Parse Errors ===\n');
parser.errors.forEach((e, i) => {
  console.log(`Error ${i + 1}:`);
  console.log(`  Message: ${e.message}`);
  console.log(`  Token: "${e.token?.value}" (${e.token?.type})`);
  console.log(`  Line: ${e.token?.line}`);
  console.log();
});

// Get the actual lines from the source
const lines = code.split('\n');
parser.errors.forEach((e, i) => {
  if (e.token?.line) {
    const lineNum = e.token.line - 1; // 0-indexed
    console.log(`Line ${e.token.line}: ${lines[lineNum]}`);
  }
});