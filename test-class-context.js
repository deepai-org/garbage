const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test if the issue is that these are being parsed as expression statements instead of method declarations
const testCode = `
export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  
  private isDeclStart(): boolean {
    const type = this.peek().type;
    const value = this.peek().value;
    
    return (
      type === TokenType.Keyword && (
        value === "import" || value === "require"
      ) ||
      type === TokenType.Operator
    );
  }
}`;

console.log('Testing method in proper class context...');

try {
  const lexer = new Lexer(testCode);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('✅ Parsing succeeded!');
  console.log('AST body length:', ast.body.length);
  
  if (parser.errors.length > 0) {
    console.log(`\n⚠️  Found ${parser.errors.length} parser errors:`);
    parser.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.message} at ${err.token?.type}:${err.token?.value}`);
    });
  } else {
    console.log('\n🎉 No errors! The method signature was parsed correctly in class context.');
  }
  
} catch (error) {
  console.log('❌ Parsing failed:', error.message);
}