const { Lexer } = require('./dist/lexer');

// Test what tokens we get
const code = `{
  ...other,
  end: 5
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}" ${t.virtualSemi ? '(virtualSemi)' : ''}`);
});