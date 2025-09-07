const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `condition ? <Success /> : <Error />`;

console.log('Testing JSX in ternary...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('AST body count:', ast.body.length);

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