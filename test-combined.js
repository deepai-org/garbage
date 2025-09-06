const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact combination
const code = `
class Test {
  private match(...values: string[]): boolean {
    for (const value of values) {
      console.log(value);
    }
    return false;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at "${e.token?.value}" (line ${e.token?.line})`);
  });
}

if (ast.body[0]?.kind === 'ClassDecl') {
  const classNode = ast.body[0];
  console.log('\nClass members:', classNode.members?.length);
  classNode.members?.forEach(m => {
    console.log(`  - ${m.name?.name || m.kind} (${m.kind})`);
  });
}