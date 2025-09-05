const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Python-style decorators with def
const code = `
@log_calls
@inject(Database)
def decorated_func(param1: str, param2: int) -> Result:
  pass
`;

console.log('=== Testing Python-style decorator ===\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens
console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log(`\nAST nodes: ${ast.body.length}`);
  console.log(`Parse errors: ${parser.errors.length}`);
  
  if (ast.body.length > 0) {
    const node = ast.body[0];
    console.log(`First node kind: ${node.kind}`);
  }
  
  if (parser.errors.length > 0) {
    console.log('\nErrors:');
    parser.errors.forEach(e => {
      console.log(`  - ${e.message}`);
    });
  }
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}