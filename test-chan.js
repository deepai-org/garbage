const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `let ch: chan<string>;`;
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:');
tokens.forEach((t, i) => console.log(`  ${i}: ${t.type} "${t.value}"`));

const parser = new Parser(tokens);
const ast = parser.parse();
console.log('\nAST:', JSON.stringify(ast, null, 2));