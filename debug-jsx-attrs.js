const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = '<input type="text" />';
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'EOF') {
        console.log(`[${i}] ${t.type}: "${t.value}"`);
    }
});

const parser = new Parser(tokens);
try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
    if (ast.body.length > 0) {
        console.log('First statement:', JSON.stringify(ast.body[0], null, 2));
    }
} catch (e) {
    console.log('\nParse error:', e.message);
    console.log('Stack:', e.stack);
}