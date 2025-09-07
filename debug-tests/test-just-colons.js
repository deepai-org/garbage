const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `Box::new(v)`;

console.log('Testing just :: expression...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (t.type !== 'WHITESPACE') {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body count:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
        if (ast.body[0].kind === 'ExprStmt') {
            console.log('Expression:', ast.body[0].expr?.kind);
        }
    }
} catch (e) {
    console.log('\nParse error:', e.message);
}