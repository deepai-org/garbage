const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test const declaration with type annotation
const code = `
class Test {
  method() {
    const body: (AST.Decl | AST.Stmt)[] = [];
    const x: number = 5;
    const y = 10;
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