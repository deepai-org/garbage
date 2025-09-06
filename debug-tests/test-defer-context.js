const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the exact code with defer from the failing test
const code = `
// Try-with-resources (Java-style)
try (FileReader file = new FileReader("test.txt")) {
  processFile(file)
} catch (IOException e) {
  print(e)
} finally {
  cleanup()
}

// Exception handling (Python-style)  
try:
  risky()
except ValueError:
  print("value error")
except Exception as e:
  print(e)
else:
  print("no exception")
finally:
  cleanup()

// Pattern-based error handling (Swift-style)
guard let result = maybeResult() else {
  return
}

// Try-catch with optional binding (Swift-style)
if let data = try? parseData() {
  use(data)
} else {
  handleError()
}

// Try-except (Python-style)
try {
  riskyOperation()
} except (ValueError) {
  print("value error")
}

// Try-rescue (Ruby)
try {
  unsafe()
} rescue (e) {
  puts e
}

// Error propagation (Rust-style)
result := doWork()?

// Panic/recover (Go-style)
defer recover()
panic("error")
`;

console.log('Testing defer in mixed error handling context...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find defer statements
const findByKind = (ast, kind) => {
    const results = [];
    const traverse = (n) => {
        if (!n) return;
        if (n.kind === kind) {
            results.push(n);
        }
        for (const key in n) {
            if (key !== 'span' && n[key]) {
                if (Array.isArray(n[key])) {
                    n[key].forEach(traverse);
                } else if (typeof n[key] === 'object') {
                    traverse(n[key]);
                }
            }
        }
    };
    traverse(ast);
    return results;
};

const deferStmts = findByKind(ast, 'Defer');
console.log('Defer statements found:', deferStmts.length);

if (deferStmts.length === 0) {
    console.log('\nAST analysis:');
    console.log('Total AST body items:', ast.body.length);
    
    // Look for the defer line specifically
    ast.body.forEach((node, i) => {
        if (node.kind === 'ExprStmt' && node.expr?.kind === 'Call' && 
            node.expr.callee?.name === 'defer') {
            console.log(`Found possible defer at [${i}]:`, node.kind, node.expr.kind);
        }
        if (node.kind === 'Defer') {
            console.log(`Found defer at [${i}]:`, node.kind);
        }
    });
    
    // Check if it's parsed as a function call instead
    const callNodes = findByKind(ast, 'Call');
    const deferCalls = callNodes.filter(c => c.callee?.name === 'defer');
    console.log('Calls with defer name:', deferCalls.length);
}