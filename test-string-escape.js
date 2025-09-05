const { Lexer } = require('./dist/lexer');

// Test various escaped strings
const testCases = [
  "'\\\\' test",  // Backslash
  "'\\n' test",   // Newline  
  "'\\'' test",   // Escaped quote
  "'\\\\\\\\'test", // Two backslashes
];

testCases.forEach(code => {
  console.log(`\\nInput: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
  });
});