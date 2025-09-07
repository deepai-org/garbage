const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test try/rescue
const code = `
async def start
  try:
    await self.listen(self.port)
  rescue => e
    console.error("Failed to start:", e)
    throw e
  end
end
`;

console.log('Testing try/rescue...\n');

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
  console.log('\nFirst statement kind:', ast.body[0].kind);
}