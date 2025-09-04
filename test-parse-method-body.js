const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test parsing the parse() method pattern exactly
const code = `
class Parser {
  parse(): AST.Program {
    const body: (AST.Decl | AST.Stmt)[] = [];
    let iterations = 0;
    const maxIterations = Math.max(1000, this.tokens.length * 2);
    
    if (typeof process !== 'undefined' && process.env.DEBUG_HANG) {
      console.log(\`[PARSE] Starting with \${this.tokens.length} tokens\`);
    }
    
    while (!this.isAtEnd()) {
      iterations++;
      if (iterations > maxIterations) {
        console.error(\`Parser exceeded\`);
        break;
      }
    }
    
    return { kind: "Program", body };
  }
  
  private helper(): void {
    return;
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
const classDecl = ast.body[0];
if (classDecl.kind === 'ClassDecl') {
  console.log(`\nClass has ${classDecl.members.length} members`);
  classDecl.members.forEach(m => {
    console.log(`  ${m.kind}: ${m.name?.name || 'unnamed'}`);
  });
}