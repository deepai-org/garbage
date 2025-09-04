const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test switch at top level (like in a method body when class ends early)
const code = `
switch (keyword) {
  case "case": return "esac";
  case "begin": return "end";
}
`;

console.log('Testing top-level switch:');
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
  console.log('AST nodes:', ast.body.length);
}