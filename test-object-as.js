const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test object literal with 'as' type assertion
const code = `
class Test {
  private makeNode() {
    return {
      kind: "Method",
      name,
      params,
      body,
      span: this.createSpan(start, this.current - 1)
    } as any;
  }
}
`;

console.log('Testing object literal with "as any":');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens around "as any":');
let foundAs = false;
tokens.forEach((t, i) => {
  if (t.value === '}' && tokens[i+1]?.value === 'as') {
    foundAs = true;
    console.log('Found "} as"');
  }
  if (foundAs && i < tokens.indexOf(tokens.find(t => t.value === 'as')) + 5) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members`);
  classNode.members?.forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name} (${m.kind})`);
  });
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}