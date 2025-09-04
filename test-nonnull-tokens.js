const { Lexer } = require('./dist/lexer');

// Test how tokens are generated for !.
const code = `obj!.property`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});