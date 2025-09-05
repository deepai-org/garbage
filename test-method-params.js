const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test method with typed parameters
const code = `
class Test {
  private parseListComprehension(expr: AST.Expr, start: number): AST.ArrayLiteral {
    return null;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens around parameter:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF' && i > 10 && i < 30) {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
}