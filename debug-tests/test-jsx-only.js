const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

console.log('=== Test JSX-only parsing ===');

const testCases = [
    `<div />`,
    `<div></div>`,
    `<Button onClick={handler} />`
];

testCases.forEach((code, i) => {
    console.log(`\n--- Test ${i + 1}: ${code} ---`);
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        if (ast.body.length > 0) {
            console.log('✅ SUCCESS: AST body length:', ast.body.length);
            console.log('Statement kind:', ast.body[0].kind);
            if (ast.body[0].kind === 'ExprStmt') {
                console.log('Expression kind:', ast.body[0].expr?.kind);
            }
        } else {
            console.log('❌ FAILED: Empty AST body');
        }
    } catch (error) {
        console.log('❌ ERROR:', error.message);
    }
});