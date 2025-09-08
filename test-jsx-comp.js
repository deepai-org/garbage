const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const TodoList = () => (
    <ul>
        {[<li key={i}>{item}</li> for item, i in items if item.active]}
    </ul>
)`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  console.log('\nTokens around "for":');
  tokens.forEach((t, i) => {
    if (t.value === 'for' || (i > 0 && tokens[i-1].value === 'for') || (i < tokens.length - 1 && tokens[i+1].value === 'for')) {
      console.log(`  ${i}: ${t.type} "${t.value}"`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nAST body length:', ast.body.length);
  if (ast.body.length > 0) {
    console.log('First item kind:', ast.body[0].kind);
  }
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
}