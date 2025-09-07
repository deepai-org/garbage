const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `process(a, b).await?`;

console.log('Testing process(a, b).await?...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('Success:', ast.body.length > 0);

console.log('Parser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}