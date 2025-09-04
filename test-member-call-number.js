const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test member call with number
const code = `
class Test {
  method() {
    res.status(500)
  }
}
`;

console.log('Testing member call with number:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find tokens around status(500)
let foundStatus = false;
console.log('Tokens around status:');
tokens.forEach((t, i) => {
  if (t.value === 'status') {
    foundStatus = true;
  }
  if (foundStatus && i < tokens.indexOf(tokens.find(t => t.value === 'status')) + 8) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}