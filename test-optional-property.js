const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test optional property in constructor
const code = `
class ParseError extends Error {
  constructor(
    message: string,
    public token: Token,
    public quickFix?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}
`;

console.log('Testing optional property in constructor:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}