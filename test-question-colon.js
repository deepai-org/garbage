const { Lexer } = require('./dist/lexer');

// Test various ? : patterns
const tests = [
  'public quickFix?: string',
  'value?: number',
  'isValid? : boolean',
  'test ? : type'
];

tests.forEach(code => {
  console.log(`\nTokenizing: "${code}"`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  });
});