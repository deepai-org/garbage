const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const code = `fn orchestrate(tasks: []Task) {
  x := 5
}`;

console.log('Testing fn with array type parameter...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
    if (i < 10) {
        console.log(`[${i}] "${t.value}" (${t.type})`);
    }
});

const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    console.log('\nAST body length:', ast.body.length);
    if (ast.body[0]) {
        console.log('First node:', ast.body[0].kind);
    }
} catch (e) {
    console.log('\nParse error:', e.message);
    console.log('Stack:', e.stack);
}