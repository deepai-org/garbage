
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
      res.status(500).json({error: err.message})
      return
    }
    
    # Bash-style conditional
    if [ "$result.cached" = "true" ]; then
      res.setHeader("X-Cache", "HIT")
    fi
    
    res.json(result)
  }
  
  # Ruby-style method with mixed blocks
  def start
    begin
      server := this.createServer()
      
      # Async IIFE
      (async () => {
        await server.listen(this.port)
        echo "Server running on port $this.port"
      })()
      
      # Signal handling with mixed syntax
      ["SIGINT", "SIGTERM"].forEach(signal => {
        process.on(signal, async () => {
          echo "Shutting down..."
          await server.close()
          process.exit(0)
        })
      })
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

console.log('Testing: parses multi-paradigm web server');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
