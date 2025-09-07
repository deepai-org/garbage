const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test Bash-style with modern JavaScript
const code = `#!/usr/bin/env node
if [ -f "config.json" ]; then
    const config = require('./config.json')
    console.log(config)
fi`;

console.log('Testing Bash-style with JS...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (i < 20 || t.value === 'fi' || t.value === 'then') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nParse successful!');
    console.log('AST body:', ast.body.length);
    ast.body.forEach((node, i) => {
        console.log(`[${i}]: ${node.kind}`);
    });
} catch (e) {
    console.log('\nParse error:', e.message);
}