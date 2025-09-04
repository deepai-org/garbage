const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from failing test
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
      return res.status(500).json({error: err.message})
    }
    
    # Pattern matching response
    match result.type:
      case "json":
        res.json(result.data)
      case "html":
        res.render(result.template, result.data)
      default:
        res.send(result.data)
    
    return result as T
  }
}

# Usage example combining different paradigms
server := new WebServer(8080)
server.use(cors())
      .use(bodyParser.json())
      .use(async (req, next) => {
        console.log(\`\${req.method} \${req.path}\`)
        await next()
      })
`;

console.log('Testing exact web server code:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
}

console.log('AST body length:', ast.body.length);
for (let i = 0; i < Math.min(3, ast.body.length); i++) {
  const node = ast.body[i];
  console.log(`  [${i}]: ${node.kind} ${node.name?.name || ''}`);
}