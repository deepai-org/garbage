const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Focus on the exact structure around line 34
const code = `
class WebServer {
  # Ruby-style method with Python async
  async def start
    try:
      await self.listen(self.port)
      console.log(\`Server running on port \${self.port}\`)
    rescue => e
      console.error("Failed to start:", e)
      throw e
    end
  end
}
`;

console.log('Testing line 34 area in class context...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find tokens around line 30 (which maps to actual line 34 in original)
console.log('All tokens:');
tokens.forEach((t, i) => {
  if (t.line >= 3 && t.line <= 7) {
    console.log(`  [${i}] Line ${t.line}: ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\nClass: ${cls.name?.name}, members: ${cls.members?.length}`);
  if (cls.members?.length > 0) {
    cls.members.forEach((m, i) => {
      console.log(`  Member ${i}: ${m.kind}`);
      if (m.kind === 'FuncDecl' && m.body?.statements) {
        console.log(`    Statements: ${m.body.statements.length}`);
      }
    });
  }
}