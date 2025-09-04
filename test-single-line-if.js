const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test single-line if statement
const code = `
function test() {
  if (x) return true;
  if (y)
    return false;
}
`;

console.log('Testing single-line if statements:');
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