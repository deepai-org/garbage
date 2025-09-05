const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
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

console.log('=== Testing decorator parsing ===\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Check if decorators are tokenized
let decoratorCount = 0;
tokens.forEach(t => {
  if (t.type === 'Decorator') {
    decoratorCount++;
  }
});

console.log(`Found ${decoratorCount} decorator tokens`);

const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log(`\nAST body length: ${ast.body.length}`);
  console.log(`Parse errors: ${parser.errors.length}`);
  
  if (ast.body.length === 0) {
    console.log('\nNo AST nodes parsed!');
  }
  
  if (parser.errors.length > 0) {
    console.log('\nFirst 5 errors:');
    parser.errors.slice(0, 5).forEach(e => {
      console.log(`  - ${e.message}`);
    });
  }
} catch (e) {
  console.log(`Parse failed: ${e.message}`);
}