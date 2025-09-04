const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test async as parameter name with default
const code = `
class Test {
  private doSomething(async = false, sync = true): void {
    console.log(async, sync);
  }
}
`;

console.log('Testing async as parameter name:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens for the parameter list
console.log('Tokens in parameter area:');
let inParams = false;
tokens.forEach((t, i) => {
  if (t.value === '(') inParams = true;
  if (inParams && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
  if (t.value === ')') inParams = false;
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}