const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test chained method call with number
const code = `
function test() {
  return res.status(500).json({error: "test"})
}
`;

console.log('Testing chained method call:');
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