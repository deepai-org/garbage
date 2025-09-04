const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test class that might break parsing
const code = `
export class Test {
  private field1: string;
  
  // This method has a problem that might break parsing
  private parseFuncDecl(async = false, unsafe = false): FuncDecl {
    const name = this.parseIdentifier();
    return { kind: "FuncDecl", name };
  }
  
  private method2(): void {
    console.log("test");
  }
}
`;

console.log('Testing class with default parameters:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const exportNode = ast.body[0];
if (exportNode?.kind === 'ExportDecl') {
  const classDecl = exportNode.declaration;
  if (classDecl?.kind === 'ClassDecl') {
    console.log(`Class has ${classDecl.members?.length || 0} members:`);
    classDecl.members?.forEach((m, i) => {
      const name = m.name?.name || m.kind || 'Unknown';
      console.log(`  ${i}: ${name}`);
    });
  }
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}