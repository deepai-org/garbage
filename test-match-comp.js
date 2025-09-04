const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
result := [
  match x {
    Some(v) if v > 0 => v * 2,
    None => 0,
    _ => -1
  }
  for x in maybeValues
  if x !== undefined
]`;

console.log('Testing match inside comprehension...');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach((t, i) => {
    if (t.type !== 'Whitespace') {
      console.log(`  [${i}] ${t.type}: "${t.value}"`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Parsed ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
  console.log('Stack:', e.stack.split('\n')[1]);
}