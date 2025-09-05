const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test object with 'end' property (a keyword)
const code = `
class Test {
  method() {
    return {
      start: 1,
      end: 2
    };
  }
  
  nextMethod() {
    return true;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log('Members parsed:', classNode.members?.length || 0);
  classNode.members?.forEach(m => {
    console.log(`  - ${m.name?.name || m.kind}`);
  });
}

console.log('\\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}"`);
  });
}