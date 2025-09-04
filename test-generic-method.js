const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test generic method
const code = `
class Test {
  async handle<T>(req: Request): Promise<T> {
    return null
  }
}
`;

console.log('Testing generic method:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
} else {
  console.log('Success!');
  const cls = ast.body[0];
  console.log('Class:', { 
    kind: cls.kind, 
    name: cls.name?.name,
    members: cls.members?.length
  });
}