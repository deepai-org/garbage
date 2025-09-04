const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test passing lambda as argument
const code = `
class Test {
  method() {
    const result = this.parsePostfix(lambda);
    return result;
  }
}
`;

console.log('Testing lambda as argument:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens around parsePostfix(lambda):');
tokens.forEach((t, i) => {
  if (t.value === 'parsePostfix') {
    for (let j = i; j < i + 5; j++) {
      if (tokens[j] && tokens[j].type !== 'VirtualSemi') {
        console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}`);
      }
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}