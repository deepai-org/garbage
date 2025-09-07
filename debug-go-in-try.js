const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the go statement inside try block
const code = `
async def start
  try:
    await self.listen(self.port)
    console.log(\`Server on \${self.port}\`)
    
    # Go-style goroutine
    go (function() {
      while true {
        await sleep(60000)
        self.healthCheck()
      }
    })()
  rescue => e
    console.error("Failed:", e)
  end
end
`;

console.log('Testing go statement in try block...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'FuncDecl') {
  const func = ast.body[0];
  console.log(`\nFunction: ${func.name?.name}`);
  console.log(`Body statements: ${func.body?.statements?.length}`);
  
  // Check the try statement
  if (func.body?.statements?.[0]?.kind === 'Try') {
    const tryStmt = func.body.statements[0];
    console.log(`Try block statements: ${tryStmt.body?.statements?.length}`);
  }
}