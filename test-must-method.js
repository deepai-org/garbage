const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the must method signature
const code = `
class Parser {
  private createMissingIdentifier(): AST.Identifier {
    return { kind: "Identifier", name: "__missing__" };
  }
  
  private must(expected: string, options?: { recoverWithSynthetic?: boolean }): boolean {
    if (this.check(expected)) {
      this.advance();
      return true;
    }
    return false;
  }
  
  private parseTopLevel(): AST.Decl | AST.Stmt | null {
    return null;
  }
}
`;

console.log('Testing must method parsing:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the class
const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`Found class with ${classNode.members?.length || 0} members:`);
  classNode.members?.forEach((m, i) => {
    const name = m.name?.name || m.kind || 'unknown';
    console.log(`  ${i}: ${name}`);
  });
} else {
  console.log('No class found');
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}