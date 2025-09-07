const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test the exact failing case from the test suite
const code = `condition ? <Success /> : <Error />`;

console.log('Testing the full ternary with JSX (exact test case)...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

console.log('\nParsing...');
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('AST body count:', ast.body.length);
    console.log('Parser errors:', parser.errors.length);

    if (parser.errors.length > 0) {
        parser.errors.forEach((err, i) => {
            console.log(`Error ${i + 1}: ${err.message}`);
        });
    }

    if (ast.body[0]) {
        const stmt = ast.body[0];
        console.log('Statement:', stmt.kind);
        if (stmt.kind === 'ExprStmt' && stmt.expr) {
            console.log('Expression:', stmt.expr.kind);
            if (stmt.expr.kind === 'Ternary') {
                console.log('Test:', stmt.expr.test?.kind);
                console.log('Consequent:', stmt.expr.consequent?.kind);
                console.log('Alternate:', stmt.expr.alternate?.kind);
            }
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
}