const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find first "Unexpected token in expression" error
const unexpectedErrors = parser.errors.filter(e => 
  e.message.includes('Unexpected token in expression'));

if (unexpectedErrors.length > 0) {
  console.log('First few "Unexpected token in expression" errors:');
  unexpectedErrors.slice(0, 5).forEach((e, i) => {
    console.log(`\nError ${i + 1}: ${e.message}`);
    if (e.token) {
      // Show context around the error
      const errorTokenIndex = tokens.indexOf(e.token);
      if (errorTokenIndex > 0) {
        console.log('  Context:');
        for (let j = Math.max(0, errorTokenIndex - 3); j < Math.min(tokens.length, errorTokenIndex + 3); j++) {
          const t = tokens[j];
          if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
            const marker = j === errorTokenIndex ? ' <-- ERROR' : '';
            console.log(`    [${j}] ${t.type}:${t.value}${marker}`);
          }
        }
      }
    }
  });
}