const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

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
  
  console.log('\nParsed successfully!');
  const impl = ast.body[0];
  console.log('Statement kind:', impl?.kind);
  
  if (impl && impl.kind === 'ImplDecl') {
    console.log('Trait:', impl.trait ? 'YES' : 'NO');
    console.log('Where clause:', impl.whereClause ? 'YES' : 'NO');
    if (impl.whereClause) {
      console.log('Constraints:', impl.whereClause.constraints.length);
    }
  }
} catch (e) {
  console.error('\nError:', e.message);
  console.error('At token:', e.token);
}