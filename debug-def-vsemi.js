const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Check tokens after def name
const code = `
class WebServer {
  def start
    console.log("Starting")
  end
}
`;

console.log('Testing def with potential virtual semicolon...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens after def:');
tokens.forEach((t, i) => {
  if (i >= 3 && i <= 10) {
    console.log(`  [${i}] ${t.type}: "${t.value}" vsemi:${t.virtualSemi || false}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`Class members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
    if (m.body?.statements) {
      console.log(`    Statements: ${m.body.statements.length}`);
    }
  });
}