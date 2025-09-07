const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `const result = condition`;

console.log('Testing simple const...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

const ast = parser.parse();
console.log('\nAST body count:', ast.body.length);

if (ast.body[0]) {
    const stmt = ast.body[0];
    console.log('Statement kind:', stmt.kind);
}

console.log('\nParser errors:', parser.errors.length);
if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}