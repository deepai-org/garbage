const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Every string style
s1 := "basic string"
s2 := 'single quotes'
s3 := \`template \${with} interpolation\`
s4 := f"Python f-string {value}"
s5 := r"raw\\nstring"
s6 := b"byte string"
s7 := """
  multiline
  string
"""
s8 := '''another
multiline'''
s9 := $"C# interpolated {expr}"
s10 := @"verbatim string"
s11 := <<EOF
heredoc content
with $variables
EOF
`;

console.log('Testing full string literals...');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Success: ${ast.body.length} nodes`);
  
  // Check if we got the expected number
  if (ast.body.length >= 11) {
    console.log('All string assignments parsed!');
  } else {
    console.log(`Only ${ast.body.length}/11 string assignments parsed`);
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
  console.log('Stack:', e.stack.split('\n')[1]);
}