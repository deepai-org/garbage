const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the problematic bash while pattern
const code = `function test() {
  while [ $retries -lt 3 ]; do
    try:
      x := 1
    except:
      pass
  done
}`;

console.log('Testing bash while with try...');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

let timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}