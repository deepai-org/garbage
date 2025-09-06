const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test boolean as return type
const code = `
class Test {
  method(): boolean {
    return true;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for method signature:');
let recording = false;
tokens.forEach((t, i) => {
  if (t.value === 'method') recording = true;
  if (recording && t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
  if (t.value === '{' && recording) recording = false;
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at "${e.token?.value}"`);
  });
}