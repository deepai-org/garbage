const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test method signature in class context - the actual failing case
const testCode = `
class TestParser {
  private parseSimpleType(): AST.TypeNode {
    return null;
  }
}`;

console.log('Testing class method signature...');
console.log('Code:', testCode);

try {
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  
  console.log('\nRelevant tokens:');
  tokens.forEach((token, i) => {
    if (token.type !== 'VirtualSemi' && token.type !== 'EOF' && 
        (token.value.includes('parseSimpleType') || token.value === ':' || 
         token.value === 'AST' || token.value === '(' || token.value === ')')) {
      console.log(`  [${i}] ${token.type}:${token.value}`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\n✅ Parsing succeeded!');
  console.log('AST body length:', ast.body.length);
  
  if (parser.errors.length > 0) {
    console.log('\n⚠️  Parser errors:');
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
    });
  }
  
} catch (error) {
  console.log('\n❌ Parsing failed:', error.message);
  
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    parser.parse();
  } catch (e) {
    console.log('Parser errors:');
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at token: ${err.token?.type}:${err.token?.value}`);
    });
  }
}