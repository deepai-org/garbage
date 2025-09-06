const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `<>Hello World</>`;
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log('✓ Parsed');
  console.log('Body:', ast.body.length);
  if (ast.body[0]) {
    console.log('First:', ast.body[0].kind);
    if (ast.body[0].expr) {
      console.log('Expr:', ast.body[0].expr.kind);
    }
  }
} catch (e) {
  console.log('✗ Error:', e.message);
}
