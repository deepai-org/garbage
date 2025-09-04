const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the bash conditional that might be causing issues
const code = `
function test() {
  if [ -n "$(this.transitions.get(key))" ]; then
    echo "test"
  fi
}`;

console.log('Testing bash conditional...');

try {
  const timeout = setTimeout(() => {
    console.log('ERROR: Parser timeout!');
    process.exit(1);
  }, 2000);
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens created:', tokens.length);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  clearTimeout(timeout);
  
  console.log(`✅ Success! AST nodes: ${ast.body.length}`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}