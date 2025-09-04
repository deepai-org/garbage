const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test defer statement
const code = `
def use(self, handler):
  defer self.log("Middleware added")
  self.middleware.push(handler)
  return self
`;

console.log('Testing defer statement:');
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
  if (ast.body.length > 0) {
    const func = ast.body[0];
    console.log('Function:', { 
      kind: func.kind, 
      name: func.name?.name,
      bodyStatements: func.body?.statements?.length
    });
  }
}