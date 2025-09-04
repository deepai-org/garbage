const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `arr := [match x {Some(v) => v, _ => 0} for x in items]`;

console.log('Testing match comprehension (no newlines):');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'Whitespace') {
    console.log(`  [${i}] ${t.type}: "${t.value}"${t.virtualSemi ? ' (virtualSemi)' : ''}`);
  }
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`\n✅ Parsed ${ast.body.length} nodes`);
  if (ast.body.length > 0) {
    console.log('AST:', JSON.stringify(ast, null, 2).substring(0, 800));
  }
} catch (e) {
  console.log(`\n❌ Error: ${e.message}`);
  console.log('Stack:', e.stack.split('\n').slice(1,3).join('\n'));
}