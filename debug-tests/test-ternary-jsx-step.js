const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug ternary JSX step by step ===');

// Let's try building up the complexity step by step
const testCases = [
    `condition ? 1 : 2`,
    `condition ? <div /> : 2`,
    `condition ? 1 : <div />`, 
    `condition ? <div /> : <span />`,
    `const x = condition ? <div /> : <span />`
];

testCases.forEach((code, i) => {
    console.log(`\n--- Test ${i + 1}: ${code} ---`);
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('Success! AST body length:', ast.body.length);
        if (ast.body.length > 0) {
            console.log('Statement kind:', ast.body[0].kind);
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
});