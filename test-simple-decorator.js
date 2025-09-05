const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test simple decorator cases
const tests = [
  {
    name: "Decorator on function",
    code: `@log
function test() {
  return 42;
}`
  },
  {
    name: "Decorator on class",  
    code: `@Component
class Test {
  field: string;
}`
  },
  {
    name: "Multiple decorators",
    code: `@log_calls
@deprecated
function test() {
  return 42;
}`
  }
];

tests.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    console.log(`AST nodes: ${ast.body.length}`);
    console.log(`Parse errors: ${parser.errors.length}`);
    
    if (ast.body.length > 0) {
      const node = ast.body[0];
      console.log(`First node kind: ${node.kind}`);
    }
    
    if (parser.errors.length > 0) {
      console.log('Errors:');
      parser.errors.forEach(e => {
        console.log(`  - ${e.message}`);
      });
    }
  } catch (e) {
    console.log(`Parse failed: ${e.message}`);
  }
});