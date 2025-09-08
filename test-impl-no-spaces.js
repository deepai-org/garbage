const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test without leading spaces
const code = `impl<T> Display for Container<T> 
where T: Display {
  fn fmt(&self, f: &mut Formatter) -> Result {
    write!(f, "{}", self.value)
  }
}`;

console.log('Code (no leading spaces):');
console.log(code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed! Body length:', ast.body.length);
  if (ast.body.length > 0) {
    console.log('First item:', ast.body[0].kind);
    const impl = ast.body[0];
    if (impl.kind === 'ImplDecl') {
      console.log('Has where clause:', impl.whereClause ? 'YES' : 'NO');
      console.log('Has trait:', impl.trait ? 'YES' : 'NO');
    }
  }
} catch (e) {
  console.error('\nParse error:', e.message);
}