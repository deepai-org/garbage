const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `impl<T> Container<T> {
  fn new() -> Self {
    Self { items: Vec::new() }
  }
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens:');
  tokens.slice(0, 10).forEach((t, i) => {
    console.log(`  ${i}: ${t.type} "${t.value}"`);
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nAST body length:', ast.body.length);
  if (ast.body.length > 0) {
    console.log('First statement:', ast.body[0].kind);
  }
} catch (e) {
  console.error('\nError:', e.message);
}