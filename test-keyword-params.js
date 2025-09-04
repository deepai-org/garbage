const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test keywords as parameter names
const code = `
class Test {
  createToken(type: TokenType, value: string): Token {
    return null;
  }
  
  checkThis(this: Context, value: any) {
    return true;
  }
  
  handleReturn(return: boolean, throw: Error) {
    console.log("test");
  }
}
`;

console.log('Testing keywords as parameter names:');
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