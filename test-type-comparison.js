const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test type comparisons vs type declarations
const code = `
// Type declaration
type MyType = string;

// Type comparison
if (type === TokenType.Keyword) {
  return true;
}

// Another comparison
const isOp = type === TokenType.Operator && value === "#";
`;

console.log('Testing type keyword in different contexts:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}' (line ${e.token.line})`);
  });
} else {
  console.log('Success!');
}