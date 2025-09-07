const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Debug const declaration parsing ===');

const testCases = [
    `const x = 5`,
    `const y = condition ? 1 : 2`,
    `const z = <div />`,
    `const result = condition ? <Success /> : <Error />`
];

testCases.forEach((code, i) => {
    console.log(`\n--- Test ${i + 1}: ${code} ---`);
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        console.log('AST body length:', ast.body.length);
        if (ast.body.length > 0) {
            const stmt = ast.body[0];
            console.log('Statement kind:', stmt.kind);
            if (stmt.kind === 'ConstDecl') {
                console.log('Has values:', 'values' in stmt);
                console.log('Values length:', stmt.values?.length);
                if (stmt.values?.length > 0) {
                    console.log('First value kind:', stmt.values[0].kind);
                }
            }
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
});