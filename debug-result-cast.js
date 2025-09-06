const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `return <Result<Vec<T>, Error>>{ok: true};`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log('\n✓ Parsed');
  console.log('AST body length:', ast.body.length);
  
  if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    
    if (stmt.kind === 'Return' && stmt.values?.length > 0) {
      const val = stmt.values[0];
      console.log('Return value kind:', val.kind);
      
      if (val.kind === 'Cast') {
        console.log('Type cast detected');
        console.log('Cast expression kind:', val.expr?.kind);
      } else if (val.kind === 'JSXElement') {
        console.log('JSX element detected');
      }
    }
  }
} catch (e) {
  console.log('\n✗ Parse error:', e.message);
  console.log('Stack:', e.stack);
}
