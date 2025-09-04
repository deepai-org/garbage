const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Function with parameter decorators
const code = `
async def decorated_func(
  @NotNull param1: str,
  @Range(min=0, max=100) param2: int
):
  pass
`;

console.log('Testing function with parameter decorators:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}

console.log('AST body length:', ast.body.length);
if (ast.body.length > 0) {
  const func = ast.body[0];
  console.log('Function:', { 
    kind: func.kind, 
    name: func.name?.name,
    params: func.params?.length
  });
}