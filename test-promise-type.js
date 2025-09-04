const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Promise<T> return type
const code = `
class WebServer {
  async handle(req: Request, res: Response): Promise<T> {
    return null
  }
}
`;

console.log('Testing Promise<T> return type:');
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
  console.log('Success!');
}