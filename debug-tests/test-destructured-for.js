const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `for (a, b) in vec { if a < b { } }`;

console.log('Testing destructured for loop...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    console.log(`[${i}] "${t.value}" (${t.type})`);
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST:');
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.log('\nParse error:', e.message);
    console.log('Stack:', e.stack);
}