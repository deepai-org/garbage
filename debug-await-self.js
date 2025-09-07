const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the await self.listen pattern
const code = `
async def start
  try:
    await self.listen(self.port)
    console.log(\`Server on \${self.port}\`)
  rescue => e
    console.error("Failed:", e)
  end
end
`;

console.log('Testing await self.listen...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens around "await self.listen":');
tokens.slice(5, 15).forEach((t, i) => {
  console.log(`  [${i+5}] ${t.type}: "${t.value}"`);
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

if (ast.body.length > 0 && ast.body[0].kind === 'FuncDecl') {
  const func = ast.body[0];
  console.log(`\nFunction: ${func.name?.name}`);
  console.log(`Body statements: ${func.body?.statements?.length}`);
}