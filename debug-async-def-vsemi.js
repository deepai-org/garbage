const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Check tokens after async def name
const code = `
class WebServer {
  async def start
    console.log("Starting")
  end
}
`;

console.log('Testing async def with potential virtual semicolon...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens after async def:');
tokens.forEach((t, i) => {
  if (i >= 3 && i <= 12) {
    console.log(`  [${i}] ${t.type}: "${t.value}" vsemi:${t.virtualSemi || false}`);
  }
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

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\nClass members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
    if (m.body?.statements) {
      console.log(`    Statements: ${m.body.statements.length}`);
    }
  });
}