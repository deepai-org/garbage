const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test complex boolean expression similar to isDeclStart
const code = `
function test() {
  return (
    type === TokenType.Keyword && (
      value === "import" || value === "require" ||
      value === "let" || value === "var" ||
      value === "export"
    ) ||
    type === TokenType.Operator && value === "#"
  );
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}" (line ${e.token?.line})`);
  });
} else {
  console.log('Successfully parsed!');
}