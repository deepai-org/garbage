const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
while true do
  echo "Processing"
  break if done
done
`;

console.log('Testing bash-style while loop...');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'Whitespace') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log(`✅ Parsed ${ast.body.length} nodes`);
} catch (e) {
  console.log(`❌ Error: ${e.message}`);
}