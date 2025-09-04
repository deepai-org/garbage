const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test method with keyword default values
const code = `
class Parser {
  private tokens: Token[] = [];
  
  private parseFuncDecl(async = false, unsafe = false, generator = false): AST.FuncDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    return { kind: "FuncDecl", name };
  }
  
  private parseOther(): void {
    console.log("test");
  }
}
`;

console.log('Testing class with keyword defaults in method params:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens for the method signature
console.log('\nTokens for parseFuncDecl signature:');
let inMethod = false;
let count = 0;
tokens.forEach((t, i) => {
  if (t.value === 'parseFuncDecl') {
    inMethod = true;
    count = 0;
  }
  if (inMethod && count < 20) {
    if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
    count++;
    if (t.value === '{') inMethod = false;
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members:`);
  classNode.members?.forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name}`);
  });
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.slice(0, 10).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}