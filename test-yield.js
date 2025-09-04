const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const tests = [
  { name: 'yield', code: 'function* gen() { yield 42 }' },
  { name: 'yield*', code: 'function* gen() { yield* other() }' },
  { name: 'yield from', code: 'def gen():\n  yield from other()' },
  { name: 'async function*', code: 'async function* gen() { yield 1 }' },
];

for (const test of tests) {
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    
    // Check tokens for function*
    if (test.name === 'yield') {
      console.log('Tokens for function*:');
      tokens.forEach(t => {
        if (t.type !== 'Whitespace') {
          console.log(`  ${t.type}: "${t.value}"`);
        }
      });
    }
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`✅ ${test.name}: ${ast.body.length} nodes`);
  } catch (e) {
    console.log(`❌ ${test.name}: ${e.message}`);
  }
}