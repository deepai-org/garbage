const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test visibility modifiers
const code = `
class Parser {
  private tokens: Token[];
  public current: number;
  protected errors: ParseError[];
  
  private parseStatement(): Statement {
    return null;
  }
  
  public parse(): AST {
    return this.parseTopLevel();
  }
  
  protected createError(msg: string): void {
    console.log(msg);
  }
}
`;

console.log('Testing visibility modifiers:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}