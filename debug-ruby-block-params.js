const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Ruby block with parameters
const code = `
Signal.trap("SIGINT") do |sig|
  console.log("Signal:", sig)
  go (async () => {
    echo "Shutting down..."
    await server.close()
    process.exit(0)
  })
end
`;

console.log('Testing Ruby block with parameters...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);
console.log('\nTokens around "do |sig|":');
tokens.slice(6, 12).forEach((t, i) => {
  console.log(`  [${i+6}] ${t.type}: "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body.length > 0) {
  console.log('\nFirst statement kind:', ast.body[0].kind);
}