const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test keywords as property names with string values
const code = `
const obj = {
  type: TokenType.Keyword,
  this: "value",
  return: true,
  throw: "error",
  if: "condition",
  for: "loop",
  class: "MyClass"
};
`;

console.log('Testing keywords as property names with mixed value types:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}