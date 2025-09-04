const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test else if patterns
const testCases = [
  `if (x) { } else if (y) { }`,
  `if (item) {
    body.push(item);
  } else if (!this.isAtEnd()) {
    console.log('test');
  }`,
  `class Test {
    method() {
      if (item) {
        body.push(item);
      } else if (!this.isAtEnd()) {
        if (this.current === beforePos) {
          console.error('test');
        }
      }
    }
  }`
];

for (const code of testCases) {
  console.log(`\nTesting: ${code.split('\n')[0]}${code.includes('\n') ? '...' : ''}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  Errors:', parser.errors.map(e => `${e.message} at '${e.token.value}'`).join(', '));
  } else {
    console.log('  Success!');
  }
}