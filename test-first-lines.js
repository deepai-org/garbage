const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get just the first few lines to isolate the issue
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n').slice(0, 10);
const testCode = lines.join('\n');

console.log('Testing first 10 lines of parser.ts:');
console.log(testCode);
console.log('\n---\n');

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();

console.log('Tokens (excluding virtual semicolons):');
tokens.forEach((t, i) => {
  if (t.type !== 'VirtualSemi' && t.type !== 'EOF' && i < 30) {
    console.log(`  [${i}] ${t.type}:${t.value || '(undefined)'}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`\nParsed ${ast.body.length} top-level nodes`);

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}