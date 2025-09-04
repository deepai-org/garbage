const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test both generic method and Promise<T>
const code = `
class WebServer {
  async handle<T>(req: Request, res: Response): Promise<T> {
    return null
  }
}
`;

console.log('Testing both generics:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the method
console.log('Tokens:');
let inMethod = false;
tokens.forEach((t, i) => {
  if (t.value === 'handle') {
    inMethod = true;
  }
  if (inMethod && i < tokens.indexOf(tokens.find(t => t.value === 'handle')) + 20) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}