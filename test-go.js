const { Parser } = require('./dist/parser');
const { Lexer } = require('./dist/lexer');

// Test go async syntax
const code = `go async () => {
  x := 1
}()`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:', tokens.map(t => t.value).join(' '));

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First error:', parser.errors[0].message);
  console.log('Error token:', parser.errors[0].token?.value);
}
console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
  console.log('First item kind:', ast.body[0].kind);
}