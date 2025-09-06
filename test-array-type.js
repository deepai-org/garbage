const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const { Transpiler } = require('./dist/transpiler');

// Test array type transpilation
const code = `
class Test {
  tokens: Token[];
  errors: ParseError[];
  numbers: number[];
}
`;

console.log('Input code:');
console.log(code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message}`);
  });
}

console.log('\nAST for class members:');
if (ast.body[0]?.kind === 'ClassDecl') {
  ast.body[0].members.forEach(m => {
    console.log(`  ${m.name?.name}: ${JSON.stringify(m.type, null, 2)}`);
  });
}

const transpiler = new Transpiler();
const output = transpiler.transpile(ast);

console.log('\nTranspiled output:');
console.log(output);