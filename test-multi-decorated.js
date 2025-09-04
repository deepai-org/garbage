const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Multiple decorated items
const code = `
@deprecated("Use newFunc instead")
async def decorated_func(param1: str):
  pass

@Component({selector: 'app-root'})
class AppComponent {
  title: string
}
`;

console.log('Testing multiple decorated items:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}

console.log('AST body length:', ast.body.length);
for (let i = 0; i < ast.body.length; i++) {
  const node = ast.body[i];
  console.log(`  [${i}]: ${node.kind} ${node.name?.name || ''}`);
}