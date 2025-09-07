const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test exact handle method from test
const code = `
class WebServer {
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    # Go-style error handling
    result, err := await this.processRequest(req)
    if err != nil {
      res.status(500).json({error: err.message})
      return
    }
    
    # Bash-style conditional
    if [ "\$result.cached" = "true" ]; then
      res.setHeader("X-Cache", "HIT")
    fi
    
    res.json(result)
  }
}
`;

console.log('Testing exact handle method...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

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