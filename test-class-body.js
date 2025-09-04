const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test parsing a class with a complex method body
const code = `
class Test {
  private field = 1
  
  public method(): void {
    if (typeof process !== 'undefined') {
      console.log('test');
    }
    return;
  }
  
  private anotherMethod(): number {
    return 42;
  }
}`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => console.log(`  ${e.message}`));
}

// Check the class structure
const classDecl = ast.body[0];
if (classDecl.kind === 'ClassDecl') {
  console.log('\nClass members:');
  classDecl.members.forEach(m => {
    console.log(`  ${m.kind}: ${m.name?.name || 'unnamed'}`);
  });
}