const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Try different variations
const tests = [
  `const x = 5;`,
  `const assertion = value;`,
  `const assertion = <Type>value;`,
  `const jsx = <Type />;`
];

tests.forEach(code => {
  console.log('\nTesting:', code);
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    console.log('  ✓ Body length:', ast.body.length);
    if (ast.body[0]) {
      console.log('  Statement kind:', ast.body[0].kind);
    }
  } catch (e) {
    console.log('  ✗ Error:', e.message);
  }
});
