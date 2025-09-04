const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Go-style error handling
const code = `
async function handle() {
  result, err := await this.processRequest(req)
  if err != nil {
    return res.status(500).json({error: err.message})
  }
  return result
}
`;

console.log('Testing Go-style error handling:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  Line ${e.token.line}: ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
}