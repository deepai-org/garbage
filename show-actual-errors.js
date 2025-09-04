const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find errors related to private/public
const visibilityErrors = parser.errors.filter(e => {
  const tokenLine = e.token?.line || 0;
  const line = lines[tokenLine - 1] || '';
  return line.includes('private') || line.includes('public') || line.includes('protected');
});

console.log(`Found ${visibilityErrors.length} visibility-related errors\n`);

// Show first 10 with context
visibilityErrors.slice(0, 10).forEach(e => {
  const tokenLine = e.token?.line || 0;
  const line = lines[tokenLine - 1] || '';
  console.log(`Line ${tokenLine}: ${e.message}`);
  console.log(`  Token: '${e.token.value}'`);
  console.log(`  Code: ${line.trim()}`);
  
  // Show what comes before
  if (tokenLine > 1) {
    console.log(`  Prev: ${lines[tokenLine - 2].trim()}`);
  }
  console.log();
});