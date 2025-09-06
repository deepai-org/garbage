const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test arrow operator
const code = `<div>{$items->map($item => <li>{$item}</li>)}</div>`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`[${i}]: ${t.type}:${t.value}`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\n✓ Parsed');
    console.log('Body length:', ast.body.length);
    console.log('Body[0]:', ast.body[0]?.kind);
} catch (e) {
    console.log('\n✗ Parse error:', e.message);
    console.log('At token:', parser.peek());
}