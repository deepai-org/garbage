const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Parse the parser itself
const code = fs.readFileSync('./src/parser.ts', 'utf8');

console.log('Parsing parser.ts...');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Results:');
console.log('- Parse errors:', parser.errors.length);
console.log('- AST nodes:', ast.body.length);

// Find where parsing stops
if (ast.body.length > 0) {
  const lastNode = ast.body[ast.body.length - 1];
  console.log('- Last parsed node:', {
    kind: lastNode.kind,
    name: lastNode.name?.name || lastNode.kind,
    span: lastNode.span
  });
  
  // Find the line number
  const lines = code.split('\n');
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1; // +1 for newline
    if (charCount > lastNode.span.end) {
      console.log(`- Parsing stops around line ${i + 1} of ${lines.length}`);
      break;
    }
  }
}

if (parser.errors.length > 0) {
  console.log('\nFirst 10 errors:');
  parser.errors.slice(0, 10).forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
}