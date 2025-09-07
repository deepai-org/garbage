const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

const tests = [
    { name: "fn simple", code: "fn test() {}" },
    { name: "function simple", code: "function test() {}" },
    { name: "def simple", code: "def test() {}" }
];

tests.forEach(test => {
    console.log(`\n=== ${test.name} ===`);
    
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    
    console.log('Tokens:');
    tokens.forEach((t, i) => {
        if (i < 5) {
            console.log(`  [${i}] "${t.value}" (${t.type})`);
        }
    });
    
    const parser = new Parser(tokens);
    
    try {
        const ast = parser.parse();
        if (ast.body[0]) {
            console.log('Result:', ast.body[0].kind);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
});