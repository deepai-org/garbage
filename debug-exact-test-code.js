const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from the test
const code = `
# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
    this.routes := new Map()
    this.middleware := []
  }
  
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
  
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    # Go-style error handling
    result, err := await this.processRequest(req)
    if err != nil {
      res.status(500).send({ error: err.message })
      throw err
    }
    return result
  }
  
  # Ruby-style method with Python async
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
}

# Usage
server := new WebServer(8080)
server.use(cors())
server.use(bodyParser())
server.start()
`;

console.log('Testing exact code from test...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 3 errors:', parser.errors.slice(0, 3).map(e => e.message));
}

if (ast.body.length === 0) {
  console.log('\nNo body statements parsed! Checking tokens around problem area...');
  console.log('First 20 tokens:');
  tokens.slice(0, 20).forEach((t, i) => {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  });
}