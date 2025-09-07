const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
  }
}

# Usage
server := new WebServer(8080)
server.use(cors())
`;

console.log('Testing web server with usage section...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Errors:', parser.errors.map(e => e.message));

console.log('\nStatement kinds:');
ast.body.forEach((stmt, i) => {
  console.log(`  [${i}] ${stmt.kind}`);
});