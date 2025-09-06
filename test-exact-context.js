const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact context from the Parser class
const code = `
export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  
  private check(value: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().value === value;
  }
  
  private match(...values: string[]): boolean {
    for (const value of values) {
      if (this.check(value)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private consume(expected: TokenType | string, message: string): Token {
    const token = this.peek();
    return token;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach((e, i) => {
    console.log(`\nError ${i + 1}:`);
    console.log(`  Message: ${e.message}`);
    console.log(`  Token: "${e.token?.value}"`);
    console.log(`  Line: ${e.token?.line}`);
  });
}