const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test just the problematic line
const code = `(
  public quickFix?: string
)`;

console.log('Testing parameter pattern:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
// Try to parse as parameter list (starting from after the opening paren)
parser.current = 1; // Skip the opening paren
try {
  const params = parser.parseParameterList();
  console.log('\nParsed successfully!');
  console.log('Parameters:', params.length);
} catch (e) {
  console.log('\nError:', e.message);
}

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}