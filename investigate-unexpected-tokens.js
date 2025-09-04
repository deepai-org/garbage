const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Unexpected token in expression" errors
const unexpectedErrors = parser.errors.filter(e => 
  e.message.includes('Unexpected token in expression')
);

// Group by the context (what comes before the error)
console.log('UNEXPECTED TOKEN PATTERNS:\n');

// Show specific problematic lines
const interestingLines = [300, 1318, 1798];
interestingLines.forEach(lineNum => {
  const error = unexpectedErrors.find(e => e.token?.line === lineNum);
  if (error) {
    console.log(`Line ${lineNum}:`);
    console.log(`  Error token: "${error.token.value}"`);
    console.log(`  Code: ${lines[lineNum - 1]?.trim()}`);
    
    // Show context
    if (lineNum > 1) {
      console.log(`  Previous line: ${lines[lineNum - 2]?.trim()}`);
    }
    console.log();
  }
});