const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = 'interface Shape { area(): number; }';

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
    console.log(`${i}: ${t.type} "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\n--- AST ---');
console.log('Body length:', ast.body.length);

if (ast.body.length > 0) {
    const iface = ast.body[0];
    console.log('Interface:', iface);
}

if (parser.errors && parser.errors.length > 0) {
    console.log('\nParser errors:');
    parser.errors.forEach(err => {
        console.log(`  - ${err.message}`);
    });
}