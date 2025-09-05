const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the specific problematic pattern: function(): type
const testCode = `private parseSimpleType(): AST.TypeNode {
  return null;
}`;

console.log('Testing specific function return type pattern...');
console.log('Code:', testCode);

try {
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens:');
  tokens.forEach((token, i) => {
    if (token.type !== 'VirtualSemi' && token.type !== 'EOF') {
      console.log(`  [${i}] ${token.type}:${token.value}`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\n✅ Parsing succeeded!');
  console.log('AST body length:', ast.body.length);
  
} catch (error) {
  console.log('\n❌ Parsing failed:', error.message);
  
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    parser.parse();
  } catch (e) {
    console.log('Errors:');
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at token: ${err.token?.type}:${err.token?.value}`);
    });
  }
}