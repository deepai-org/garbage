const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test simpler case
const code = `
class Test {
  constructor(public x: number) {
    console.log(x);
  }
}
`;

console.log('Testing constructor with public parameter:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

// Add logging to parseParameter
const origParseParam = parser.parseParameter?.bind(parser);
if (origParseParam) {
  parser.parseParameter = function() {
    const token = this.peek();
    console.log(`parseParameter: current token = ${token.type}:${token.value}`);
    const result = origParseParam.call(this);
    console.log(`  -> parsed param: ${result.name?.name}, visibility: ${result.visibility}`);
    return result;
  };
}

const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members`);
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}