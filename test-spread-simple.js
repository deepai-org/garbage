const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test simpler cases
const cases = [
  '{ end: 5 }',                  // Just 'end' property
  '{ ...other }',                // Just spread
  '{ ...other, x: 5 }',          // Spread with regular property
  '{ ...other, end: 5 }',        // Spread with 'end' property
  '{ a: 1, ...other, end: 5 }',  // Mixed
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