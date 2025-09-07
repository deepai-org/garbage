const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from the test file
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
    if [ "\$result.cached" = "true" ]; then
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
        echo "Server running on port \$this.port"
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

console.log('Testing exact code from test file...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  console.log('\\nFirst 5 errors:');
  parser.errors.slice(0, 5).forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}" (line ${err.token.line})`);
  });
}

console.log('\\nStatements parsed:');
ast.body.forEach((stmt, i) => {
  console.log(`  [${i}] ${stmt.kind}`);
  if (stmt.kind === 'ClassDecl') {
    console.log(`      Class: ${stmt.name?.name}, members: ${stmt.members?.length}`);
  }
});