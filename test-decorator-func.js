const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplified decorator test
const code = `
@deprecated("Use newFunc instead")
async def decorated_func(param1: str):
  pass
`;

console.log('Testing decorator function:');
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
  console.log('AST body length:', ast.body.length);
  if (ast.body.length > 0) {
    const func = ast.body[0];
    console.log('First node:', { kind: func.kind, name: func.name?.name });
  }
}