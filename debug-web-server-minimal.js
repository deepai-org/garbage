const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Start with just the class declaration
const code = `
# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
  }
}
`;

console.log('Testing minimal web server...\n');
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nToken count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
}