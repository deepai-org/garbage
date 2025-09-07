const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

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

console.log('Testing complex web server...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Total tokens:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Errors:', parser.errors.length, parser.errors.slice(0, 3).map(e => e.message));

console.log('\nStatement kinds:');
ast.body.forEach((stmt, i) => {
  console.log(`  [${i}] ${stmt.kind}`);
});