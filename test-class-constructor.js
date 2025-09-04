const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test class with constructor and methods
const code = `
export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => 
      t.type !== TokenType.Comment && 
      t.type !== TokenType.Whitespace
    );
  }
  
  private getErrors(): ParseError[] {
    return this.errors;
  }
  
  private parse(): AST.Program {
    const body = [];
    return { kind: "Program", body };
  }
}
`;

console.log('Testing class with constructor:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Check the class
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