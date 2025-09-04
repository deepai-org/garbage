const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test filter with multiline arrow function (like in Parser constructor)
const code = `
class Test {
  constructor(tokens) {
    this.tokens = tokens.filter(t => 
      t.type !== TokenType.Comment && 
      t.type !== TokenType.Whitespace
    );
  }
}
`;

console.log('Testing filter with multiline arrow:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}' (line ${e.token.line})`);
  });
} else {
  console.log('Success!');
  
  // Check the class
  const classNode = ast.body[0];
  if (classNode?.kind === 'ClassDecl') {
    console.log(`Class has ${classNode.members?.length || 0} members`);
  }
}