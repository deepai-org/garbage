const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test async def inside a class
const code = `
class WebServer {
  # Ruby-style method with Python async
  async def start
    try:
      await self.listen(self.port)
      console.log(\`Server on \${self.port}\`)
    rescue => e
      console.error("Failed:", e)
      throw e
    end
  end
}
`;

console.log('Testing async def inside class...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\nClass: ${cls.name?.name}, members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}`);
    if (m.name) {
      console.log(`    Name: ${m.name.name || m.name}`);
    }
  });
}