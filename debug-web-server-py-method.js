const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Add Python-style method
const code = `
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
  }
  
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
}
`;

console.log('Testing with Python-style method...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
  if (ast.body[0].kind === 'ClassDecl') {
    const cls = ast.body[0];
    console.log('Class members:', cls.members?.length);
  }
}