const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Read parser.ts file
const parserSource = fs.readFileSync('src/parser.ts', 'utf-8');

// Get first few lines to check what's failing
const lines = parserSource.split('\n');
console.log('First 20 lines of parser.ts:');
console.log('---');
lines.slice(0, 20).forEach((line, i) => {
  console.log(`${(i+1).toString().padStart(3)}: ${line}`);
});

console.log('\n--- Parsing ---\n');

// Try to lex and parse it
const lexer = new Lexer(parserSource);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

const errors = parser.getErrors();
console.log(`Total errors: ${errors.length}`);

// Group errors by type
const errorCounts = {};
errors.forEach(err => {
  errorCounts[err.message] = (errorCounts[err.message] || 0) + 1;
});

console.log('\nError types and counts:');
Object.entries(errorCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([msg, count]) => {
    console.log(`  ${count.toString().padStart(4)}x: ${msg}`);
  });

// Find first few errors with their tokens
console.log('\nFirst 10 errors with context:');
errors.slice(0, 10).forEach((err, i) => {
  console.log(`\nError ${i+1}: ${err.message}`);
  if (err.token) {
    console.log(`  Token: ${err.token.type} = "${err.token.value}"`);
    console.log(`  Line: ${err.token.line}, Column: ${err.token.column}`);
    
    // Show the line
    if (err.token.line > 0 && err.token.line <= lines.length) {
      const lineContent = lines[err.token.line - 1];
      console.log(`  Code: ${lineContent.trim()}`);
    }
  }
});