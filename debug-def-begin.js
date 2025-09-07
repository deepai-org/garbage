const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test def with begin block
const code = `
class WebServer {
  def start
    begin
      server := this.createServer()
      echo "Starting server"
    rescue => e
      console.error("Failed:", e)
    end
  end
}
`;

console.log('Testing def with begin...rescue...end...\\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Token count:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\\nAST body length:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
  parser.errors.forEach((err, i) => {
    console.log(`Error ${i + 1}: ${err.message} at token: "${err.token.value}"`);
  });
}

if (ast.body[0]?.kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\\nClass members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
    if (m.kind === 'FuncDecl' && m.body?.statements) {
      console.log(`    Statements: ${m.body.statements.length}`);
    }
  });
}