const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplified test with just a switch statement in a method
const code = `
class Test {
  private method(): void {
    const x = 1;
    switch (x) {
      case 'n': break;
      case 't': break;
      case '\\\\': break;
      default: break;
    }
    return;
  }
  
  private nextMethod(): void {
    return;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  classNode = classNode;
}

console.log(`Members parsed: ${classNode.members?.length || 0}`);

// Show which members were parsed
if (classNode.members) {
  classNode.members.forEach((m, idx) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${idx}: ${name} (${m.kind})`);
  });
}

console.log(`\\nParse errors: ${parser.errors.length}`);

// Show errors
if (parser.errors.length > 0) {
  console.log('\\nErrors:');
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token '${e.token?.value}' (line ${e.token?.line})`);
  });
}