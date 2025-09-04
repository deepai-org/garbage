const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const tests = [
  { name: 'List comp', code: 'list1 := [x * 2 for x in range(10) if x % 2 == 0]' },
  { name: 'Set comp', code: 'set1 := {x for x in items if x.valid}' },
  { name: 'Dict comp', code: 'dict1 := {k: v for k, v in pairs}' },
  { name: 'Gen expr', code: 'gen1 := (x * x for x in numbers)' },
  { name: 'JS gen', code: 'function* jsGenerator() { yield 42 }' },
  { name: 'Py gen', code: 'def pyGenerator():\n  yield from another_gen()\n  return result' },
  { name: 'Async gen', code: 'async function* asyncGen() { yield 1 }' },
];

for (const test of tests) {
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`✅ ${test.name}: ${ast.body.length} nodes`);
  } catch (e) {
    console.log(`❌ ${test.name}: ${e.message}`);
  }
}