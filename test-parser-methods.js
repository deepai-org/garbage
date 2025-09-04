const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test actual failing pattern from parser.ts
const code = `
  private parseTopLevel(): AST.Decl | AST.Stmt | null {
    if (this.isAtEnd()) return null;
    
    // Skip virtual semicolons before statements
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    if (this.isAtEnd()) return null;
    
    // Check for decorators
    let decorators: AST.Decorator[] = [];
    while (this.peek().value === "@") {
      decorators.push(this.parseDecorator());
    }
    
    // Now check if it's a declaration or statement
    if (this.isDeclStart()) {
      const decl = this.parseDeclaration();
      if (decorators.length > 0 && decl) {
        // Apply decorators to the declaration
        if ('decorators' in decl) {
          (decl as any).decorators = decorators;
        }
      }
      return decl;
    }
    
    return this.parseStatement();
  }
`;

console.log('Testing parser method pattern:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show first 10 tokens
console.log('First 10 tokens:');
tokens.slice(0, 10).forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}