const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test simpler version to isolate issue
const tests = [
  {
    name: "Basic begin-end",
    code: `begin
  x = 1
end`
  },
  {
    name: "Begin with rescue",
    code: `begin
  x = 1
rescue
  y = 2
end`
  },
  {
    name: "Begin with try inside",
    code: `begin
  try:
    x = 1
  except:
    y = 2
end`
  },
  {
    name: "Try-except outside begin",
    code: `try:
  x = 1
except:
  y = 2`
  }
];

tests.forEach(test => {
  console.log(`\n${test.name}:`);
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    console.log(`  ✓ AST body length: ${ast.body.length}`);
    if (parser.errors && parser.errors.length > 0) {
      console.log(`  ⚠ Parse errors: ${parser.errors.length}`);
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
  }
});