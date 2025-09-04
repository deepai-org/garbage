const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const testCases = [
  { name: 'Basic string', code: 's := "basic string"' },
  { name: 'Single quotes', code: "s := 'single quotes'" },
  { name: 'Template literal', code: 's := `template ${with} interpolation`' },
  { name: 'F-string', code: 's := f"Python f-string {value}"' },
  { name: 'Raw string', code: 's := r"raw\\nstring"' },
  { name: 'Byte string', code: 's := b"byte string"' },
  { name: 'Triple quotes', code: 's := """multiline"""' },
  { name: 'C# interpolated', code: 's := $"C# interpolated {expr}"' },
  { name: 'C# verbatim', code: 's := @"verbatim string"' },
];

for (const test of testCases) {
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