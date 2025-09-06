const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test enum parsing
const code = `
export enum TokenType {
  Identifier = "Identifier",
  Keyword = "Keyword",
  EOF = "EOF"
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Parse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message} at "${e.token?.value}" (line ${e.token?.line})`);
  });
}

if (ast.body[0]) {
  console.log('\nAST:', JSON.stringify(ast.body[0], null, 2));
}