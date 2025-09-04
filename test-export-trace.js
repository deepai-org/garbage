const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test simple export class
const code = `export class MyClass { }`;

console.log('Testing export class:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body:', ast.body.length);
if (ast.body.length > 0) {
  console.log('First node kind:', ast.body[0].kind);
  if (ast.body[0].declaration) {
    console.log('Declaration kind:', ast.body[0].declaration.kind);
  }
}

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}