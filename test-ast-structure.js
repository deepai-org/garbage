const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `match value {
  Some(x) if x > 0 => "positive"
}`;

console.log('Testing AST structure...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('Full AST:');
console.log(JSON.stringify(ast, null, 2));