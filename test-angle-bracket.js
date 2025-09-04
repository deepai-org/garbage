const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = '<number>someValue';
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:', tokens.map(t => `${t.type}:${t.value}`).join(' '));

const parser = new Parser(tokens);
try {
  const ast = parser.parse();
  console.log('AST:', JSON.stringify(ast.body[0], null, 2));
} catch (e) {
  console.log('Error:', e.message);
  console.log('Parser errors:', parser.errors.map(e => e.message));
}