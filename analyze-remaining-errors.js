const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Group errors by message pattern
const errorGroups = {};
parser.errors.forEach(e => {
  const msg = e.message.split(' at token')[0];
  if (!errorGroups[msg]) {
    errorGroups[msg] = [];
  }
  errorGroups[msg].push(e);
});

// Sort by frequency
const sortedGroups = Object.entries(errorGroups)
  .sort((a, b) => b[1].length - a[1].length);

console.log('TOP ERROR PATTERNS:');
console.log('==================\n');

sortedGroups.slice(0, 10).forEach(([msg, errors]) => {
  console.log(`${errors.length} errors: ${msg}`);
  
  // Show first 3 examples
  console.log('  Examples:');
  errors.slice(0, 3).forEach(e => {
    const line = lines[e.token.line - 1] || '';
    console.log(`    Line ${e.token.line}: "${e.token.value}" in: ${line.trim().substring(0, 50)}...`);
  });
  console.log();
});