const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test case keyword in string literal
const code = `
function test() {
  switch (keyword) {
    case "case": return "esac";
  }
}
`;

console.log('Testing case in string literal:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the problematic area
console.log('Tokens:');
let inCase = false;
tokens.forEach((t, i) => {
  if (t.value === 'case' || inCase) {
    if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
    if (t.value === ';') inCase = false;
    else if (t.value === 'case') inCase = true;
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