const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `case $x in
  1) echo "one";;
esac`;

console.log('Code:', code);
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.filter(t => t.type !== 'Whitespace' && t.type !== 'VirtualSemi').forEach((t, i) => {
  console.log(`  ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body:', ast.body.length);
if (ast.body.length > 0) {
  console.log('Success!');
} else {
  console.log('Errors:', parser.errors.map(e => e.message));
}