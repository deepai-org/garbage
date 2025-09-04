const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the template literal part
const code = 'throw new Error(`Pipeline failed: ${e.message}`)';

console.log('Testing template literal...');
console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('Tokens:');
  tokens.forEach(t => {
    if (t.type !== 'Whitespace') {
      console.log(`  ${t.type}: "${t.value}"`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`✅ Success! AST nodes: ${ast.body.length}`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}