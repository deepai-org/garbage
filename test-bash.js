const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testParse(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`  Success! AST body length: ${ast.body.length}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

// Test bash conditionals
testParse('if [ $x -gt 5 ]; then echo "hi"; fi', 'Simple bash if');
testParse('if [ -f file ]; then echo "exists"; fi', 'Bash file test');
testParse('while [ $i -lt 10 ]; do echo $i; done', 'Bash while loop');

// Test simpler version
testParse('if true; then echo "hi"; fi', 'Simple if-then-fi');
testParse('if true then echo "hi" fi', 'If without semicolons');