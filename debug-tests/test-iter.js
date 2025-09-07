const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `vec.iter()`;

console.log('Testing vec.iter()...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('Success:', ast.body.length > 0);
if (ast.body[0]) {
    const expr = ast.body[0].expr;
    console.log('Expression kind:', expr?.kind);
    if (expr?.kind === 'Call') {
        console.log('Callee:', expr.callee?.kind);
    }
}

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}