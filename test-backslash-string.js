const { Lexer } = require('./dist/lexer');

// Test string with two backslashes
const code = "'\\\\' test";
console.log('Input code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\\nTokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: ${JSON.stringify(t.value)}`);
  }
});

// What we expect:
// Token 0: StringLiteral "'\\\\'"
// Token 1: Identifier "test"