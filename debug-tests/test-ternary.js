const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `x ? y : z`;

console.log('Testing ternary operator...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('Success:', ast.body.length > 0);
if (ast.body[0]) {
    const expr = ast.body[0].expr;
    console.log('Expression kind:', expr?.kind);
}

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}