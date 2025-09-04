const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test different keywords as property names
const keywords = [
  'if', 'for', 'while', 'class', 'function', 
  'return', 'throw', 'break', 'continue', 'type'
];

keywords.forEach(kw => {
  const code = `const obj = { ${kw}: value };`;
  console.log(`\nTesting keyword "${kw}":`);
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('  Tokens around keyword:');
  tokens.forEach((t, i) => {
    if (i >= 3 && i <= 7 && t.type !== 'EOF') {
      console.log(`    [${i}] ${t.type}:${t.value}`);
    }
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  if (parser.errors.length > 0) {
    console.log(`  ERROR: ${parser.errors[0].message}`);
  } else {
    console.log('  SUCCESS');
  }
});