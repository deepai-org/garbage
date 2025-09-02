const { Parser } = require('./dist/parser');
const { Lexer } = require('./dist/lexer');

// Test the async function that's failing
const code = `async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
  results := []
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First 20 tokens:', tokens.slice(0, 20).map(t => t.value).join(' '));

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parser errors:', parser.errors);
console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
  console.log('First item:', JSON.stringify(ast.body[0], null, 2));
}