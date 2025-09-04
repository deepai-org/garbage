const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test single-line loops
const code = `
function test() {
  while (x) x--;
  for (let i = 0; i < 10; i++) console.log(i);
}
`;

console.log('Testing single-line loops:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}