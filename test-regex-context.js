const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test regex in if statement context (like line 5551)
const code = `
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(content)) {
  console.log("not valid");
}
`;

console.log('Input:', code);
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
let tokenIndex = 0;
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF' && t.type !== 'Whitespace') {
    console.log(`  [${tokenIndex++}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
}