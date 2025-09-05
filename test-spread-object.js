const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test object spread
const code = `
const obj = {
  ...other,
  end: 5
};
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
} else {
  console.log('Successfully parsed!');
}