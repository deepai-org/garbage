const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplify to just the match method
const code = `
class Parser {
  private match(...values: string[]): boolean {
    for (const value of values) {
      if (this.check(value)) {
        return true;
      }
    }
    return false;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens for the for loop
console.log('Tokens around for loop:');
let inForLoop = false;
tokens.forEach((t, i) => {
  if (t.value === 'for') inForLoop = true;
  if (inForLoop && t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
  if (t.value === '}' && inForLoop) inForLoop = false;
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at "${e.token?.value}" (line ${e.token?.line})`);
  });
}

// Check the AST
if (ast.body[0]?.kind === 'ClassDecl') {
  const classNode = ast.body[0];
  console.log('\nClass members:', classNode.members?.length);
  classNode.members?.forEach(m => {
    console.log(`  - ${m.name?.name || m.kind} (${m.kind})`);
  });
}