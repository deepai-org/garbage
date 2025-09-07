const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the transition between methods
const code = `
class WebServer {
  async handle<T>(): Promise<T> {
    return result
  }
  
  async def start
    console.log("Starting")
  end
}
`;

console.log('Testing method transition...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens around transition:');
tokens.forEach((t, i) => {
  if (i >= 12 && i <= 25) {
    console.log(`  [${i}] ${t.type}: "${t.value}" (line ${t.line})`);
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

if (ast.body.length > 0 && ast.body[0].kind === 'ClassDecl') {
  const cls = ast.body[0];
  console.log(`\nClass: ${cls.name?.name}, members: ${cls.members?.length}`);
  cls.members?.forEach((m, i) => {
    console.log(`  Member ${i}: ${m.kind}, name: ${m.name?.name || m.name}`);
    if (m.kind === 'FuncDecl' && m.body?.statements) {
      console.log(`    Body statements: ${m.body.statements.length}`);
    }
  });
}