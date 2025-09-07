const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Test just associated type constraints
const code = `type F = Future<Item = V>;`;

console.log('Testing associated type constraint...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (i < 15) {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nSuccess! AST body length:', ast.body.length);
} catch (e) {
    console.log('\nFailed:', e.message);
}