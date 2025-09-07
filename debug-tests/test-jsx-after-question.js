const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test just the "? <Success />" part
const code = `condition ? <Success />`;

console.log('Testing JSX after question mark...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE' && t.type !== 'EOF') {
        console.log(`  [${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body count:', ast.body.length);
console.log('Parser errors:', parser.errors.length);

if (parser.errors.length > 0) {
    parser.errors.forEach(err => {
        console.log('Error:', err.message);
    });
}