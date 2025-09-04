const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test class with complex method
const code = `
class WebServer {
  async handle<T>(req: Request): Promise<T> {
    result, err := await this.processRequest(req)
    if err != nil {
      return res.status(500).json({error: err.message})
    }
    return result as T
  }
}
`;

console.log('Testing class with complex method:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
  const cls = ast.body[0];
  console.log('Class members:', cls.members?.length);
}