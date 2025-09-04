const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test type annotations in function parameters
const testCases = [
  '(x: number)',
  '(x: number, y: string)',
  '(x?: number)',
  '(x: number = 5)',
  'function test(x: number): void { }',
  '(x: number) => x * 2',
];

for (const code of testCases) {
  console.log(`\nTesting: ${code}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('Errors:', parser.errors.map(e => e.message).join(', '));
  } else {
    console.log('Success!');
  }
}