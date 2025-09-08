const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Override console.error to capture warnings
const originalError = console.error;
const warnings = [];
console.error = function(...args) {
  warnings.push(args.join(' '));
  originalError.apply(console, args);
};

const code = `impl<T> Display for Container<T> 
      where T: Display {
        fn fmt(&self, f: &mut Formatter) -> Result {
          write!(f, "{}", self.value)
        }
      }`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed! Body length:', ast.body.length);
  if (ast.body.length > 0) {
    console.log('First item:', ast.body[0].kind);
  }
  
  console.log('\nWarnings captured:');
  warnings.forEach(w => console.log('  -', w));
} catch (e) {
  console.error('\nParse error:', e.message);
  console.error('Stack:', e.stack);
}