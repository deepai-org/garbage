const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `impl<T> Display for Container<T> 
      where T: Display {
        fn fmt(&self, f: &mut Formatter) -> Result {
          write!(f, "{}", self.value)
        }
      }`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nAll tokens:');
tokens.forEach((t, i) => {
  const type = t.type.padEnd(12);
  const value = JSON.stringify(t.value).padEnd(20);
  const flags = [];
  if (t.virtualSemi) flags.push('VSEMI');
  console.log(`  ${i.toString().padStart(2)}: ${type} ${value} ${flags.join(' ')}`);
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  console.log('\nParsed! Body length:', ast.body.length);
} catch (e) {
  console.error('\nParse error:', e.message);
}