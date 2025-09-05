const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with assignment (proper context for object literals)
const cases = [
  'const x = { end: 5 }',
  'const x = { ...other }',  
  'const x = { ...other, x: 5 }',
  'const x = { ...other, end: 5 }',
];

cases.forEach(code => {
  console.log(`\nTest: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  FAILED with errors:');
    parser.errors.forEach(e => {
      console.log(`    - ${e.message}`);
    });
  } else {
    console.log('  SUCCESS');
  }
});