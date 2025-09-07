const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the generic method that's around line 21 in the original
const code = `
class WebServer {
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    # Go-style error handling
    result, err := await this.processRequest(req)
    if err != nil {
      res.status(500).send({ error: err.message })
      throw err
    }
    return result
  }
}
`;

console.log('Testing generic method in class...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for generic method:');
tokens.slice(3, 25).forEach((t, i) => {
  console.log(`  [${i+3}] ${t.type}: "${t.value}" (line ${t.line})`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\nClass: ${cls.name?.name}, members: ${cls.members?.length}`);
}