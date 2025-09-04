const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from failing test
const code = `
# Decorator usage per spec section 13
@deprecated("Use newFunc instead")
@memoize
@log_calls
@inject(Database)
@Override
async def decorated_func(
  @NotNull param1: str,
  @Range(min=0, max=100) param2: int
) -> Result[str, Error]:
  pass
@Component({
  selector: 'app-root',
  template: \`<div>{{title}}</div>\`
})
class AppComponent {
  @Input() title: string
  @Output() clicked = new EventEmitter()
  
  @HostListener('click')
  onClick() {
    this.clicked.emit()
  }
}
`;

console.log('Testing exact failing code:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('First 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
}

console.log('AST body length:', ast.body.length);
for (let i = 0; i < Math.min(3, ast.body.length); i++) {
  const node = ast.body[i];
  console.log(`  [${i}]: ${node.kind} ${node.name?.name || ''}`);
}