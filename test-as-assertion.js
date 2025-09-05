const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test 'as' type assertion
const tests = [
  {
    name: "Simple as assertion",
    code: `const x = {kind: "Test"} as any;`
  },
  {
    name: "As assertion in return",
    code: `function test() {
      return {kind: "PredicateType"} as any;
    }`
  },
  {
    name: "Nested as assertion",
    code: `const x = {
      value: ({kind: "Test"} as any)
    };`
  }
];

tests.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    console.log(`Success! AST nodes: ${ast.body.length}`);
    console.log(`Parse errors: ${parser.errors.length}`);
    
    if (parser.errors.length > 0) {
      parser.errors.forEach(e => {
        console.log(`  - ${e.message}`);
      });
    }
  } catch (e) {
    console.log(`Parse failed: ${e.message}`);
    console.log(`Errors: ${parser.errors.length}`);
  }
});