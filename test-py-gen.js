const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Python generator with proper indentation
const code1 = `
def pyGenerator():
  yield from another_gen()
  return result
`;

// Test with consistent indentation
const code2 = `
def pyGenerator():
  yield from another_gen()
  return result
`;

for (const [name, code] of [['Code1', code1], ['Code2', code2]]) {
  console.log(`\nTesting ${name}:`);
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`✅ Parsed ${ast.body.length} nodes`);
    if (ast.body.length > 0) {
      console.log(`  Node type: ${ast.body[0].kind}`);
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}`);
  }
}