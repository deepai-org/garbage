const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
async function test() {
  while [ $x -lt 3 ]; do
    try:
      pass
    except:
      pass
  done
}`;

console.log('Getting tokens...');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log(`Got ${tokens.length} tokens`);

console.log('\nCreating parser...');
const startTime = Date.now();

const timeout = setTimeout(() => {
  console.log('ERROR: Parser constructor exceeded 1 second!');
  console.log('Likely issue with token filtering');
  process.exit(1);
}, 1000);

const parser = new Parser(tokens);
clearTimeout(timeout);

const elapsed = Date.now() - startTime;
console.log(`Parser created in ${elapsed}ms`);

console.log('\nCalling parse()...');
const parseTimeout = setTimeout(() => {
  console.log('ERROR: parse() exceeded 1 second!');
  process.exit(1);
}, 1000);

const ast = parser.parse();
clearTimeout(parseTimeout);

console.log(`✅ Success! AST nodes: ${ast.body.length}`);