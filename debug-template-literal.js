const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test template literal
const code = 'console.log(`Server running on port ${self.port}`)';

console.log('Testing template literal...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);
console.log('Tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}