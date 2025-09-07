const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test go with IIFE
const code = `go (function() {
  console.log("test")
})()`;

console.log('Testing go with IIFE...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);
console.log('\nTokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body.length > 0) {
  console.log('\nAST:');
  console.log(JSON.stringify(ast.body[0], null, 2).substring(0, 500));
}