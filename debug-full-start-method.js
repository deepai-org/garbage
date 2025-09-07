const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the full start method as in the original
const code = `
async def start
  try:
    await self.listen(self.port)
    console.log(\`Server running on port \${self.port}\`)
    
    # Go-style goroutine simulation
    go (function() {
      while true {
        await sleep(60000)
        self.healthCheck()
      }
    })()
    
    # Ruby-style signal handling
    Signal.trap("SIGINT") do |sig|
      console.log("Received signal:", sig)
      go (async () => {
        echo "Shutting down..."
        await server.close()
        process.exit(0)
      })
    end
  rescue => e
    console.error("Failed to start:", e)
    throw e
  end
end
`;

console.log('Testing full start method...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

if (ast.body.length > 0 && ast.body[0].kind === 'FuncDecl') {
  const func = ast.body[0];
  console.log(`\nFunction: ${func.name?.name}`);
  console.log(`Body statements: ${func.body?.statements?.length}`);
}