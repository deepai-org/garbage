const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact pattern from parser.ts
const code = `
export class Parser {
  private tokens: Token[] = []
  private current = 0
  
  parse(): AST.Program {
    const body: (AST.Decl | AST.Stmt)[] = [];
    let iterations = 0;
    const maxIterations = Math.max(1000, this.tokens.length * 2);
    
    if (typeof process !== 'undefined' && process.env.DEBUG_HANG) {
      console.log(\`[PARSE] Starting with \${this.tokens.length} tokens\`);
    }
    
    while (!this.isAtEnd()) {
      iterations++;
    }
    
    return { kind: "Program", body };
  }
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('\nErrors:');
  parser.errors.forEach(e => console.log(`  ${e.message} at line ${e.token.line}`));
}

// Check the class structure
const exportDecl = ast.body[0];
if (exportDecl.kind === 'ExportDecl') {
  const classDecl = exportDecl.declaration;
  if (classDecl.kind === 'ClassDecl') {
    console.log(`\nClass ${classDecl.name.name} has ${classDecl.members.length} members`);
    classDecl.members.forEach(m => {
      console.log(`  ${m.kind}: ${m.name?.name || 'unnamed'}`);
    });
  }
}