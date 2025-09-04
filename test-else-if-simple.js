const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplest case
const code = `if (x) { a(); } else if (y) { b(); }`;

console.log('Testing:', code);
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
  console.log('AST:', JSON.stringify(ast.body[0], null, 2));
}