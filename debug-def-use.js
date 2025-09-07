const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the def use method
const code = `
class WebServer {
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
}
`;

console.log('Testing def use method...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for def use:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}" (line ${t.line})`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\\nClass members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
  });
}