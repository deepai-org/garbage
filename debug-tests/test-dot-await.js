const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `x.await`;

console.log('Testing x.await...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

const ast = parser.parse();
console.log('\nSuccess:', ast.body.length > 0);
if (ast.body[0]) {
    console.log('Expression:', JSON.stringify(ast.body[0].expr, null, 2));
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}