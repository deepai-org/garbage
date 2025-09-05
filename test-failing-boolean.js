const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact failing boolean expression from isDeclStart
const testCode = `
  private isDeclStart(): boolean {
    const type = this.peek().type;
    const value = this.peek().value;
    
    return (
      type === TokenType.Keyword && (
        value === "import" || value === "require" ||
        value === "let" || value === "var" || value === "auto" ||
        value === "fn" || value === "fun" || value === "function" || value === "def" || value === "func" ||
        value === "const" || value === "final" || value === "immutable" ||
        value === "class" || value === "struct" || value === "interface" ||
        value === "trait" || value === "enum" ||
        value === "package" || value === "export"
      ) ||
      type === TokenType.Operator && value === "#" && 
      this.peekNext()?.type === TokenType.Identifier && 
      this.peekNext()?.value === "include"
    );
  }
`;

console.log('Testing the exact failing boolean expression...');

try {
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('✅ Parsing succeeded!');
  
  if (parser.errors.length > 0) {
    console.log(`\n⚠️  Found ${parser.errors.length} parser errors:`);
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
    });
  }
  
} catch (error) {
  console.log('❌ Parsing failed:', error.message);
  
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    parser.parse();
  } catch (e) {
    console.log('Parser errors:');
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
    });
  }
}