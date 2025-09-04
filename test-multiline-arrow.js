const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test multiline arrow function
const code = `
const result = items.filter(t => 
  t.type !== TokenType.Comment && 
  t.type !== TokenType.Whitespace
);
`;

console.log('Testing multiline arrow function:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the arrow
console.log('Tokens:');
let showNext = 0;
tokens.forEach((t, i) => {
  if (t.value === '=>' || showNext > 0) {
    if (t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
    if (t.value === '=>') showNext = 10;
    else showNext--;
  }
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