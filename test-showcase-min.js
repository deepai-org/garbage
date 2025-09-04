const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Minimal version of the problematic code
const code = `async function processData() {
  try {
    for await (const item of stream) {
      retries := 0
    }
  } catch (e) {
    throw new Error(e)
  } finally {
    return {results}
  }
}`;

console.log('Testing showcase code...');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Parsing...');
let timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser is stuck in infinite loop!');
  process.exit(1);
}, 2000);

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}