const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Ruby-style async def
const code = `
class WebServer {
  # Ruby-style method with Python async
  async def start
    console.log("Starting")
  end
}
`;

console.log('Testing async def...\n');

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

if (ast.body.length > 0) {
  console.log('\nParsed successfully');
  const cls = ast.body[0];
  if (cls.kind === 'ClassDecl') {
    console.log('Class members:', cls.members?.length);
  }
}