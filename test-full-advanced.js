const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from failing comprehension test
const code = `
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

console.log('Parsing full comprehension test...');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`✅ Parsed ${ast.body.length} nodes (expected >= 8)`);
  
  // Show what we got
  ast.body.forEach((node, i) => {
    console.log(`  [${i}] ${node.kind}`);
  });
  
  // Check for errors
  if (parser.errors && parser.errors.length > 0) {
    console.log('Parser errors:', parser.errors);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
  console.log('Stack:', e.stack.split('\n').slice(0, 3).join('\n'));
}