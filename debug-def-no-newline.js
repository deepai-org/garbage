const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test exactly as in the failing test - no newline after return self
const code = `
class WebServer {
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
  
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    result, err := await this.processRequest(req)
    return result
  }
}
`;

console.log('Testing def followed by generic method...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

// Look for tokens around the transition
console.log('\\nTokens around transition (return self to async handle):');
let foundReturn = false;
tokens.forEach((t, i) => {
  if (t.value === "return" && tokens[i+1]?.value === "self") {
    foundReturn = true;
  }
  if (foundReturn && i < tokens.findIndex(tok => tok.value === "return" && tokens[tokens.indexOf(tok)+1]?.value === "self") + 10) {
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