const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `impl<T> Container<T> {
  type Item = T;
  const CAPACITY: usize = 100;
  
  fn new() -> Self {
    Self { items: Vec::new() }
  }
  
  fn push(&mut self, item: T) {
    self.items.push(item);
  }
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nTotal statements:', ast.body.length);
  
  if (ast.body.length > 0 && ast.body[0].kind === 'ImplDecl') {
    const impl = ast.body[0];
    console.log('Impl members:', impl.members.length);
    impl.members.forEach((m, i) => {
      console.log(`  ${i}: ${m.kind} - ${m.name?.name || '(no name)'}`);
    });
  }
} catch (e) {
  console.error('Error:', e.message);
  console.error('Stack:', e.stack);
}