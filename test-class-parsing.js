const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test parsing a simple class with private methods
const code = `
export class Parser {
  private tokens: Token[] = []
  private current = 0
  
  private must(expected: string, options?: any): boolean {
    return true
  }
  
  parse(): Program {
    return { body: [] }
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Total tokens:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST nodes:', ast.body.length);
console.log('Parse errors:', parser.errors.length);

if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach(e => console.log(' ', e.message));
}