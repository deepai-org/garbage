const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `(condition ? <Success /> : <Error />)`;

console.log('Testing parenthesized ternary with JSX...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
let count = 0;
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && count++ < 15) {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

const ast = parser.parse();
console.log('\nAST body count:', ast.body.length);

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    if (stmt.kind === 'ExprStmt') {
        console.log('Expression kind:', stmt.expr?.kind);
    }
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}