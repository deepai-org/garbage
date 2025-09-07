const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `Box::new(async move { x })`;

console.log('Testing Box::new parsing...\n');

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
    console.log('\nParsed AST:');
    console.log(JSON.stringify(ast.body[0], null, 2));
} catch (e) {
    console.log('\nParse error:', e.message);
}