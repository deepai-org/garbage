const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');
const util = require('util');

// Test generic function call
const code = `const result = source<Data>();`;

console.log('Testing generic function call...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST:');
    console.log(util.inspect(ast.body[0], { depth: 5, colors: true }));
} catch (e) {
    console.log('Parse error:', e.message);
}