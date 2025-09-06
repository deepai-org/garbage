const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `type Complex = Result<Option<Vec<Map<string, Array<T>>>>, Error>;`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log('\n✓ Parsed');
  console.log('Body length:', ast.body.length);
  
  if (ast.body[0]) {
    console.log('Statement kind:', ast.body[0].kind);
  }
} catch (e) {
  console.log('\n✗ Parse error:', e.message);
}
