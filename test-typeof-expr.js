const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the specific patterns from parse() method
const testCases = [
  `if (typeof process !== 'undefined') { }`,
  `if (typeof process !== 'undefined' && process.env.DEBUG) { }`,
  `console.log(\`Starting with \${tokens.length} tokens\`)`,
  `const x = typeof y !== 'undefined'`,
  `class Test {
    method() {
      if (typeof process !== 'undefined') {
        console.log('test');
      }
    }
  }`
];

for (const code of testCases) {
  console.log(`\nTesting: ${code.split('\n')[0]}${code.includes('\n') ? '...' : ''}`);
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log('  Errors:', parser.errors.map(e => e.message).join(', '));
  } else {
    console.log('  Success!');
  }
}