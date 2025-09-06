const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test if basic JSX still works
const code = `<div>hello</div>`;

console.log('Testing basic JSX...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

console.log('Starting parse...');
const start = Date.now();
const ast = parser.parse();
const end = Date.now();

console.log(`Parse completed in ${end - start}ms`);
console.log('AST nodes:', ast.body.length);