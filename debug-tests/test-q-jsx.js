const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `? <Success />`;

console.log('Testing ? followed by JSX...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

const ast = parser.parse();
console.log('\nAST body count:', ast.body.length);

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}