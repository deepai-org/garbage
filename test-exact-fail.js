const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `impl<T> Display for Container<T> 
      where T: Display {
        fn fmt(&self, f: &mut Formatter) -> Result {
          write!(f, "{}", self.value)
        }
      }`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens (first 20):');
  tokens.slice(0, 20).forEach((t, i) => {
    console.log(`  ${i}: ${t.type} "${t.value}"${t.virtualSemi ? ' [VSEMI]' : ''}`);
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nAST body length:', ast.body.length);
  console.log('AST body:', JSON.stringify(ast.body, null, 2));
} catch (e) {
  console.error('\nError:', e.message);
  console.error('Stack:', e.stack);
}