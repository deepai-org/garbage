const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Minimal reproduction of the parse() method structure
const code = `
class Parser {
  errors: ParseError[] = []
  
  parse(): AST.Program {
    const body: (AST.Decl | AST.Stmt)[] = [];
    
    while (!this.isAtEnd()) {
      try {
        const stmt = this.parseTopLevel();
        if (stmt) body.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    
    return { kind: "Program", body };
  }
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens for parse() method body:');
let inMethod = false;
let braceDepth = 0;
tokens.forEach((t, i) => {
  if (t.value === 'parse' && tokens[i+1]?.value === '(') {
    inMethod = true;
    console.log('--- parse() method starts ---');
  }
  
  if (inMethod && t.type !== 'VirtualSemi' && t.type !== 'EOF') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
    
    if (t.value === '{') braceDepth++;
    if (t.value === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        console.log('--- parse() method ends ---');
        inMethod = false;
      }
    }
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => console.log(`  ${e.message}`));
}