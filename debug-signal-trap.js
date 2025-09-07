const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test Signal.trap with do/end
const code = `
Signal.trap("SIGINT") do |sig|
  console.log("Received signal:", sig)
end
`;

console.log('Testing Signal.trap do/end...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);
console.log('\nTokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
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
  console.log('\nFirst statement:');
  console.log(JSON.stringify(ast.body[0], null, 2).substring(0, 500));
}