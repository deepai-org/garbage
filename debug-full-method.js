const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the full problematic start method
const code = `
class WebServer {
  async def start
    try:
      console.log(\`Server on port \${self.port}\`)
      
      go (function() {
        while true {
          await sleep(60000)
        }
      })()
      
      Signal.trap("SIGINT") do |sig|
        console.log("Signal:", sig)
      end
    rescue => e
      console.error("Failed:", e)
      throw e
    end
  end
}
`;

console.log('Testing full start method...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

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

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
}