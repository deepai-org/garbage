const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test parsing methods with return types
const code = `
class Test {
  simple() {
    return 1;
  }
  
  withReturn(): number {
    return 42;
  }
  
  withParams(x: number): string {
    return x.toString();
  }
  
  async asyncMethod(): Promise<void> {
    await something();
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

// Check the class
const classDecl = ast.body[0];
if (classDecl.kind === 'ClassDecl') {
  console.log('\nClass members:');
  classDecl.members.forEach(m => {
    console.log(`  ${m.kind}: ${m.name?.name || 'unnamed'}`);
  });
}