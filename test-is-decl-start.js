const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test what isDeclStart thinks about method signatures
const testCases = [
  'private parseSimpleType(): AST.TypeNode {',
  'parseSimpleType(): AST.TypeNode {',
  'public isType(): boolean {',
  'isType(): boolean {'
];

console.log('=== Testing isDeclStart for function signatures ===\n');

testCases.forEach((testCode, i) => {
  console.log(`Test ${i + 1}: ${testCode}`);
  
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  // Access the private isDeclStart method by parsing and checking state
  try {
    // We need to access the parser's internal state
    // Let's see what happens when we try to parse this
    console.log(`  First token: ${tokens[0]?.type}:${tokens[0]?.value}`);
    console.log(`  Second token: ${tokens[1]?.type}:${tokens[1]?.value}`);
    
    const ast = parser.parse();
    console.log('  ✅ Parsed as declaration');
    
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    console.log(`  Errors: ${parser.errors.length}`);
    
    if (parser.errors.length > 0) {
      parser.errors.slice(0, 2).forEach(err => {
        console.log(`    - ${err.message} at ${err.token?.type}:${err.token?.value}`);
      });
    }
  }
  console.log();
});