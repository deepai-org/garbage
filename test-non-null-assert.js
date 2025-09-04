const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test non-null assertion operator
const code = `
function test() {
  const x = value!;
  const y = obj!.property;
  const z = array![0];
  return {
    path: path!,
    alias: name!,
    value: this.previous()!.token
  };
}
`;

console.log('Testing non-null assertion operator:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}