const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
// Try-catch-finally (JavaScript/Java)
try {
  risky()
} catch (e) {
  console.error(e)
} finally {
  cleanup()
}

// Try-except (Python)
try {
  danger()
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

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

console.log('Parsing...');
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Error details:', parser.errors[0].message);
}

// Count different node types
let tryCount = 0;
let deferCount = 0;
let exprCount = 0;

function countNodes(node) {
  if (!node || typeof node !== 'object') return;
  
  if (node.kind === 'Try') tryCount++;
  if (node.kind === 'Defer') deferCount++;
  if (node.kind === 'ExprStmt') exprCount++;
  
  // Recurse into arrays
  for (const key in node) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(countNodes);
    } else if (typeof value === 'object') {
      countNodes(value);
    }
  }
}

countNodes(ast);

console.log('Try statements found:', tryCount);
console.log('Defer statements found:', deferCount);
console.log('Expression statements found:', exprCount);

// Show what statements were parsed
console.log('\nParsed statements:');
ast.body.forEach((stmt, i) => {
  console.log(`${i}: ${stmt.kind}`);
});