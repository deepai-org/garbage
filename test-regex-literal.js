const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test regex literal parsing
const testCases = [
  '/^[A-Za-z_][A-Za-z0-9_]*$/',  // From line 5551
  '/test/',
  '/\\//',  // Escaped forward slash
  '/[a-z]+/i',  // With flags
];

testCases.forEach(code => {
  console.log(`\nInput: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach((t, i) => {
    if (t.type !== 'EOF' && t.type !== 'VirtualSemi') {
      console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('Parse errors:');
    parser.errors.forEach(e => {
      console.log(`  - ${e.message}`);
    });
  } else {
    console.log('Successfully parsed!');
  }
});