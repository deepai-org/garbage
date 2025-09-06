const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test union type in parameter
const code1 = `
class Test {
  private consume(expected: TokenType | string, message: string): Token {
    return null;
  }
}
`;

// Test for...of loop
const code2 = `
function test(...values: string[]): boolean {
  for (const value of values) {
    if (check(value)) {
      return true;
    }
  }
  return false;
}
`;

[code1, code2].forEach((code, i) => {
  console.log(`\n=== Test ${i + 1} ===`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('Errors:');
    parser.errors.forEach(e => {
      console.log(`  - ${e.message} at "${e.token?.value}"`);
    });
  } else {
    console.log('SUCCESS');
  }
});