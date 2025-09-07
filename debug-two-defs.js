const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test two def methods
const code = `
class WebServer {
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
  
  # Another method
  async handle() {
    return result
  }
}
`;

console.log('Testing two methods with Python def...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens around transition (lines 7-10):');
tokens.forEach((t, i) => {
  if (t.line >= 7 && t.line <= 10) {
    console.log(`  [${i}] Line ${t.line}: ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\\nClass members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
  });
}