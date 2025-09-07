const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
    this.routes := new Map()
    this.middleware := []
  }
  
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
}`;

console.log('Testing multi-paradigm web server parsing...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Errors:', parser.errors.map(e => e.message));

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
  if (ast.body[0].kind === 'ClassDecl') {
    const cls = ast.body[0];
    console.log('Class name:', cls.name?.name);
    console.log('Members:', cls.members?.length);
  }
}