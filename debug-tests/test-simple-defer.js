const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `defer recover()
panic("error")`;

console.log('Testing simple defer...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
ast.body.forEach((node, i) => {
    console.log(`[${i}]: ${node.kind}`);
    if (node.kind === 'Defer') {
        console.log('  ✅ Found defer statement');
    }
});