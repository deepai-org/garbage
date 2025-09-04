const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test method with destructuring and if statement
const code = `
class WebServer {
  async handle<T>(req: Request, res: Response): Promise<T> {
    result, err := await this.processRequest(req)
    if err != nil {
      return res.status(500).json({error: err.message})
    }
    return result as T
  }
}
`;

console.log('Testing method with destructuring:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
}