const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `export { foo, bar as baz };`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed!');
  if (ast.body.length > 0) {
    const exp = ast.body[0];
    console.log('Export kind:', exp.kind);
    console.log('Specifiers:', exp.specifiers);
  }
} catch (e) {
  console.error('\nError:', e.message);
}