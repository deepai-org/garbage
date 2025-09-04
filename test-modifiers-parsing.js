const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with modifiers that could confuse the parser
const code = `
class Parser {
  private parseMethod(): void { }
  
  private parseFuncDecl(async = false): void {
    console.log("test");
  }
  
  private async parseAsync(): Promise<void> { }
  
  private unsafe parseUnsafe(): void { }
}
`;

console.log('Testing methods with various modifiers:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nKey tokens:');
tokens.forEach((t, i) => {
  if ((t.value === 'private' || t.value === 'async' || t.value === 'unsafe' || t.value === 'parseFuncDecl') 
      && t.type !== 'Comment') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members:`);
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