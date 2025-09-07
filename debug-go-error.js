const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Go-style error handling
const code = `
async handle() {
  result, err := await this.processRequest(req)
  if err != nil {
    res.status(500).json({error: err.message})
    return
  }
  res.json(result)
}
`;

console.log('Testing Go-style error handling...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] Line ${t.line}: ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}