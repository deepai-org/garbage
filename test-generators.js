const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Comprehensions (working)
list1 := [x * 2 for x in range(10) if x % 2 == 0]
set1 := {x for x in items if x.valid}
dict1 := {k: v for k, v in pairs}
gen1 := (x * x for x in numbers)

# Generator functions (probably failing)
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

console.log('Testing generators...');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Parsed ${ast.body.length} nodes`);
  
  if (ast.body.length >= 8) {
    console.log('All 8 expected items parsed!');
  } else {
    console.log(`Only ${ast.body.length}/8 items parsed`);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}