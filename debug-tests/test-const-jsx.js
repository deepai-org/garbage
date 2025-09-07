const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `const result = condition ? <Success /> : <Error />`;

console.log('Testing const with JSX ternary...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

const ast = parser.parse();
console.log('AST body count:', ast.body.length);

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    console.log('Statement properties:', Object.keys(stmt));
    
    if (stmt.kind === 'ConstDecl') {
        console.log('Values:', stmt.values);
        console.log('Pairs:', stmt.pairs);
    }
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}