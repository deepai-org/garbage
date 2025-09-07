const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `<Component />`;

console.log('Testing simple JSX component...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nParsing...');
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
    if (stmt.kind === 'ExprStmt') {
        console.log('Expression kind:', stmt.expr?.kind);
    }
}