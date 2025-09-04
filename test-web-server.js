const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Web server test with Python-style method
const code = `
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
  }
  
  def use(self, handler):
    self.middleware.push(handler)
    return self
}
`;

console.log('Testing web server class:');
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
    const cls = ast.body[0];
    console.log('First node:', { kind: cls.kind, name: cls.name?.name });
  }
}