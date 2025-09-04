const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with comments
const code = `
# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
  }
}

# Another class
class Another {
  x: number
}
`;

console.log('Testing code with comments:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}

console.log('AST body length:', ast.body.length);
for (let i = 0; i < ast.body.length; i++) {
  const node = ast.body[i];
  console.log(`  [${i}]: ${node.kind} ${node.name?.name || ''}`);
}