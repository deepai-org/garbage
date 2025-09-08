const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various unknown/unsupported syntax
const testCases = [
  {
    name: 'Macro invocation',
    code: `class Foo {
      @unknown_decorator
      println!("Hello");
    }`
  },
  {
    name: 'Unknown modifiers',
    code: `class Bar {
      volatile x: number;
      synchronized method() {}
    }`
  },
  {
    name: 'Unknown operators',
    code: `x := 5 <=> 10`
  }
];

testCases.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  console.log('Code:', test.code);
  
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('Parsed successfully!');
    console.log('AST body length:', ast.body.length);
    
    // Check if any data was preserved
    const jsonStr = JSON.stringify(ast, null, 2);
    
    // Look for preserved unknown tokens
    if (jsonStr.includes('Unknown') || jsonStr.includes('unknown')) {
      console.log('✓ Unknown syntax preserved in AST');
    } else {
      console.log('✗ Unknown syntax may have been discarded');
    }
  } catch (e) {
    console.error('Parse error:', e.message);
  }
});