const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Minimal reproduction
const code = `begin
  try:
    with context:
      x = 1
  except:
    pass
end`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'Whitespace' && t.type !== 'VirtualSemi') {
    console.log(`[${i}] ${t.type}: "${t.value}" line ${t.line}`);
  }
});

console.log('\nParsing with debug...');
process.env.DEBUG_PARSER = '1';

const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`\nAST body length: ${ast.body.length}`);
console.log('Parse errors:', parser.errors.length);

if (parser.errors && parser.errors.length > 0) {
  parser.errors.forEach((err) => {
    console.log(`- ${err.message}`);
  });
}