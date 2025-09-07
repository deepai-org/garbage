const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Focus on the problematic line 30 area
const code = `
async def start
  try:
    await self.listen(self.port)
  rescue => e
    console.error("Failed:", e)
  end
end
`;

console.log('Testing async def with try/rescue...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

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