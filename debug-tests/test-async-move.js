const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `async move { x }`;

console.log('Testing async move block...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('AST body count:', ast.body.length);
if (ast.body[0]) {
    console.log('First node:', JSON.stringify(ast.body[0], null, 2));
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}