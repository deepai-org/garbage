const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testParseDetailed(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens:');
    tokens.filter(t => t.type !== 'Whitespace' && t.type !== 'VirtualSemi').forEach(t => {
      console.log(`  ${t.type}: "${t.value}"`);
    });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`AST body length: ${ast.body.length}`);
    if (ast.body.length > 0) {
      console.log(`First statement kind: ${ast.body[0].kind}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    console.log(`  Stack: ${e.stack}`);
  }
}

// Test problematic while loop
testParseDetailed('while [ $i -lt 10 ]; do echo $i; done', 'Bash while loop');

// Simpler version
testParseDetailed('while true do echo "hi" done', 'Simple while do done');

// Even simpler
testParseDetailed('while true { echo "hi" }', 'While with braces');