const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(parserSource);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

console.log('=== Checking early parsing errors ===\n');

// Try to parse and collect all errors
try {
  const ast = parser.parse();
  console.log(`Parsing completed. AST body length: ${ast.body.length}`);
} catch (e) {
  console.log('Parsing failed with exception:', e.message);
}

console.log(`\nTotal errors found: ${parser.errors.length}`);

// Group errors by message type
const errorGroups = {};
parser.errors.forEach(err => {
  const key = err.message;
  errorGroups[key] = (errorGroups[key] || 0) + 1;
});

console.log('\nError message breakdown:');
Object.entries(errorGroups)
  .sort((a, b) => b[1] - a[1])
  .forEach(([message, count]) => {
    console.log(`  ${count}x: ${message}`);
  });

// Find the first few errors to see what goes wrong early
console.log('\n=== First 10 errors (chronological) ===');
parser.errors.slice(0, 10).forEach((err, i) => {
  const tokenIndex = tokens.indexOf(err.token);
  
  // Try to estimate line number
  let charCount = 0;
  let lineNum = 1;
  if (err.token && err.token.start !== undefined) {
    const lines = parserSource.split('\n');
    let tempCharCount = 0;
    for (let j = 0; j < lines.length; j++) {
      if (tempCharCount + lines[j].length >= err.token.start) {
        lineNum = j + 1;
        break;
      }
      tempCharCount += lines[j].length + 1;
    }
  }
  
  console.log(`${i + 1}. [~line ${lineNum}] ${err.message} at ${err.token?.type}:${err.token?.value}`);
});