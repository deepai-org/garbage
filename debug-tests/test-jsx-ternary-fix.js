const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `const result = condition ? <Success /> : <Error />`;

console.log('Testing JSX in ternary (the failing test)...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body count:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
    
    if (stmt.kind === 'ConstDecl') {
        console.log('Const name:', stmt.names[0].name);
        console.log('Has values:', !!stmt.values);
        if (stmt.values) {
            console.log('Value count:', stmt.values.length);
            console.log('First value kind:', stmt.values[0]?.kind);
        }
    }
}