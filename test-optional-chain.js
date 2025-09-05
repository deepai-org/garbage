const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test optional chaining
const code = `
const result = this.peekNext()?.type === TokenType.Identifier && 
               this.peekNext()?.value === "include";
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
}