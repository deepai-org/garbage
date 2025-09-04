const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `s := <<EOF
heredoc content
with variables
EOF`;

console.log('Testing heredoc...');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach(t => {
    if (t.type !== 'Whitespace') {
      console.log(`  ${t.type}: "${t.value}"`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Success: ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}