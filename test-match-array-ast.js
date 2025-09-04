const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test match in array and inspect AST
const matchInArray = `arr := [
  match x {
    Some(v) if v > 0 => v * 2,
    None => 0,
    _ => -1
  }
]`;

console.log('Testing match in array with assignment:');
try {
  const lexer = new Lexer(matchInArray);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Parsed ${ast.body.length} nodes`);
  if (ast.body.length > 0) {
    console.log('AST:', JSON.stringify(ast, null, 2).substring(0, 1000));
  }
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}