const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test without line break
const code1 = `impl<T> Display for Container<T> where T: Display {
  fn fmt(&self) -> Result { }
}`;

// Test with line break before where
const code2 = `impl<T> Display for Container<T>
where T: Display {
  fn fmt(&self) -> Result { }
}`;

function testCode(code, label) {
  console.log(`\n${label}:`);
  console.log('Code:', code);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('Body length:', ast.body.length);
    if (ast.body.length > 0) {
      const impl = ast.body[0];
      console.log('Kind:', impl.kind);
      if (impl.kind === 'ImplDecl') {
        console.log('Has where clause:', impl.whereClause ? 'YES' : 'NO');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testCode(code1, 'Single line');
testCode(code2, 'Multi line');