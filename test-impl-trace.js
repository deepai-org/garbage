const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `impl<T> Container<T> {
  type Item = T;
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens:');
  tokens.forEach((t, i) => {
    console.log(`  ${i}: ${t.type} "${t.value}"${t.virtualSemi ? ' [VIRTUAL_SEMI]' : ''}`);
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nAST:', JSON.stringify(ast, null, 2));
} catch (e) {
  console.error('\nError:', e.message);
  console.error('At token:', e.token);
}