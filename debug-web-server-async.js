const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Add async generic method
const code = `
class WebServer {
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    return result
  }
}
`;

console.log('Testing async generic method...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);
console.log('\nFirst 20 tokens:');
tokens.slice(0, 20).forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (type: ${err.token.type})`);
  });
}

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
}