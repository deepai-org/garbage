const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test exported class pattern
const code = `
export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  public errors: ParseError[] = [];
  
  private parseStatement(): Statement {
    return null;
  }
  
  public parse(): AST {
    return this.parseTopLevel();
  }
}
`;

console.log('Testing exported class:');
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