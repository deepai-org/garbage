const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Check context around line 147 where error occurs
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lines = code.split('\n');

console.log('Lines 145-150:');
for (let i = 144; i < 150; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}

// Now tokenize just this section to see what's happening
const snippet = lines.slice(145, 150).join('\n');
const lexer = new Lexer(snippet);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach(t => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  ${t.type}:${t.value}`);
  }
});