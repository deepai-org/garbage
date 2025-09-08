const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `x, [a, b] := getValue()`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  console.log(`  ${i}: ${t.type} "${t.value}"`);
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nAST:', JSON.stringify(ast.body[0], null, 2));
} catch (e) {
  console.error('\nError:', e.message);
  console.error('Stack:', e.stack);
}