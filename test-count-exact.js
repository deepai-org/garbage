const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Parse each part separately to count
const parts = [
  'list1 := [x * 2 for x in range(10) if x % 2 == 0]',
  'set1 := {x for x in items if x.valid}',
  'dict1 := {k: v for k, v in pairs}',
  'gen1 := (x * x for x in numbers)',
  'function* jsGenerator() {\n  yield* otherGen()\n  yield 42\n}',
  'def pyGenerator():\n  yield from another_gen()\n  return result',
  'async function* asyncGen() {\n  for await (const item of stream) {\n    if item.ready:\n      yield item.value\n  }\n}',
];

let total = 0;
parts.forEach((code, i) => {
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`Part ${i+1}: ${ast.body.length} node(s)`);
    total += ast.body.length;
  } catch (e) {
    console.log(`Part ${i+1}: ERROR - ${e.message}`);
  }
});

console.log(`\nTotal: ${total} nodes (expected >= 8)`);

// Now test the full combined code
const fullCode = `
# Comprehension fusion
list1 := [x * 2 for x in range(10) if x % 2 == 0]
set1 := {x for x in items if x.valid}
dict1 := {k: v for k, v in pairs}
gen1 := (x * x for x in numbers)
# Generator functions
function* jsGenerator() {
  yield* otherGen()
  yield 42
}
def pyGenerator():
  yield from another_gen()
  return result
# Async generators
async function* asyncGen() {
  for await (const item of stream) {
    if item.ready:
      yield item.value
  }
}
`;

console.log('\nFull code test:');
const lexer = new Lexer(fullCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(`Parsed ${ast.body.length} nodes`);