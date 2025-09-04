const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with the actual escaped template literal from the test
const code = 'throw new Error(\\`Pipeline failed: \\${e.message}\\`)';

console.log('Testing escaped template literal...');
console.log('Code:', code);
console.log('Code length:', code.length);

try {
  const timeout = setTimeout(() => {
    console.log('ERROR: Timeout!');
    process.exit(1);
  }, 1000);
  
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
  
  clearTimeout(timeout);
  
  console.log(`✅ Success! AST nodes: ${ast.body.length}`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}