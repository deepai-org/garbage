const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the specific complex boolean pattern from line 316
const testCode = `
return (
  type === TokenType.Keyword && (
    value === "import" || value === "require"
  ) ||
  type === TokenType.Operator
);
`;

console.log('Testing complex boolean expression pattern...');
console.log('Code:', testCode);

try {
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens around parentheses and operators:');
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
    console.log('Parser errors:');
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at token: ${err.token?.type}:${err.token?.value}`);
    });
  }
}