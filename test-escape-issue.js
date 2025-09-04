const { Lexer } = require('./dist/lexer');

// This is what's in the test file - escaped backticks
const testCode = '    throw new Error(\\`Pipeline failed: \\${e.message}\\`)';

console.log('Original test code:', testCode);
console.log('Length:', testCode.length);

// What the test expects (unescaped)
const expectedCode = '    throw new Error(`Pipeline failed: ${e.message}`)';
console.log('\nExpected code:', expectedCode);

// Try to tokenize the escaped version
console.log('\n=== Tokenizing escaped version ===');
try {
  const lexer1 = new Lexer(testCode);
  const tokens1 = lexer1.tokenize();
  console.log('Tokens from escaped:');
  tokens1.forEach(t => {
    if (t.type !== 'Whitespace') {
      console.log(`  ${t.type}: "${t.value}"`);
    }
  });
} catch (e) {
  console.log('Error:', e.message);
}

// Try to tokenize the expected version
console.log('\n=== Tokenizing expected version ===');
try {
  const lexer2 = new Lexer(expectedCode);
  const tokens2 = lexer2.tokenize();
  console.log('Tokens from expected:');
  tokens2.forEach(t => {
    if (t.type !== 'Whitespace') {
      console.log(`  ${t.type}: "${t.value}"`);
    }
  });
} catch (e) {
  console.log('Error:', e.message);
}