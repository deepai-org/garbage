const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplified code that should create the error
const code = `
class WebServer {
  constructor() { }
}

# This should be a separate statement
server := new WebServer()
`;

console.log('Testing synchronize issue...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

console.log('\nStatements:');
ast.body.forEach((stmt, i) => {
  console.log(`  [${i}] ${stmt.kind}`);
});