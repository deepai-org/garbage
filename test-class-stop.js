const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Find exactly where and why class parsing stops
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Show lines 85-95 to see the context
console.log('Lines 85-95 of parser.ts:');
for (let i = 84; i < 95; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

// Find what tokens are around line 90
console.log('\nTokens around line 90:');
let found = false;
for (let i = 0; i < tokens.length; i++) {
  const token = tokens[i];
  if (token.line >= 88 && token.line <= 92) {
    if (!found) {
      console.log(`Starting at token index ${i}`);
      found = true;
    }
    if (token.type !== 'VirtualSemi') {
      console.log(`  [${i}] Line ${token.line}: ${token.type}:${token.value}`);
    }
  }
  if (token.line > 92) break;
}

// Check parse errors around this area
console.log('\nParse errors around line 90:');
const relevantErrors = parser.errors.filter(e => 
  e.token.line >= 85 && e.token.line <= 95
);
relevantErrors.forEach(e => {
  console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
});