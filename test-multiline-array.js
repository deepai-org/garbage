const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test multi-line array
const code = `
const arr = [
  'one', 'two', 'three',
  'four', 'five', 'six'
];
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"${t.virtualSemi ? ' (virtual semi)' : ''}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at "${e.token?.value}" (line ${e.token?.line})`);
  });
}