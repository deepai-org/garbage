const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test if 'of' as keyword breaks things
const tests = [
  'const x = { of: 5 }',  // 'of' as object property
  'for (const x of arr) { }',  // 'of' in for-of loop
  'function test(of) { }',  // 'of' as parameter name (should fail?)
];

tests.forEach(code => {
  console.log(`\nTest: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  FAILED:');
    parser.errors.forEach(e => {
      console.log(`    - ${e.message}`);
    });
  } else {
    console.log('  SUCCESS');
  }
});